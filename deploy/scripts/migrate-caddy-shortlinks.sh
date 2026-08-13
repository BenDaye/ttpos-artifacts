#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  deploy/scripts/migrate-caddy-shortlinks.sh [options]

Build a candidate Caddyfile by replacing one site block in the target Caddyfile
with the canonical block from deploy/Caddyfile. Defaults are safe for dry-run.

Options:
  --source <path>             Source Caddyfile with the canonical block.
                              Default: deploy/Caddyfile next to this script.
  --target <path>             Target host Caddyfile. Default: /opt/caddy/Caddyfile
  --site <hostname>           Target site block to migrate. Default: update.ttpos.dev
  --source-site <hostname>    Source site block in --source. Default: --site
  --output <path>             Candidate output path. Default: mktemp path.
  --shortlink-json <path>     Validate the generated /dl map against the
                              legacy short-latest.json catalog.
  --api-upstream <upstream>   API reverse_proxy upstream. Default: source block.
  --dashboard-upstream <upstream>
                              Dashboard reverse_proxy upstream. Default: source block.
  --mcp-upstream <upstream|none>
                              MCP reverse_proxy upstream, or "none" to remove
                              the /mcp* handle. Default: source block.
  --validate <auto|container|binary|none>
                              Validation method. Default: auto
  --caddy-container <name>    Caddy container for validate/reload. Default: caddy
  --container-config <path>   Caddyfile path inside container for reload.
                              Default: /etc/caddy/Caddyfile
  --apply                     Backup target and replace it with the candidate.
  --reload                    Reload Caddy after --apply.
  --check                     Drift gate: exit 2 when the target differs from
                              the candidate on any functional line. Whole-line
                              comments and blank lines are ignored. Never
                              writes; cannot be combined with --apply.
  -h, --help                  Show this help.

Examples:
  # Dry-run on a production host; writes a candidate and validates it.
  ./deploy/scripts/migrate-caddy-shortlinks.sh

  # Apply and reload on the target host after reviewing the candidate behavior.
  ./deploy/scripts/migrate-caddy-shortlinks.sh --apply --reload

  # Local regression check against a copied legacy Caddyfile.
  ./deploy/scripts/migrate-caddy-shortlinks.sh \
    --target tmp/legacy.Caddyfile \
    --output tmp/migrated.Caddyfile \
    --validate none

  # Dry-run the prod variant. Caddy's full Caddyfile is host-owned infra (globals +
  # other projects), NOT carried in this repo — first fetch a copy of the real host
  # file, then splice this repo's site fragment into that copy. Prod is derived from
  # the same deploy/Caddyfile source via flags (site/upstreams/mcp), no second file.
  #   scp prod-host:/ttpos-releases/docker/caddy/Caddyfile tmp/prod-host.Caddyfile
  ./deploy/scripts/migrate-caddy-shortlinks.sh \
    --source-site update.ttpos.dev \
    --target tmp/prod-host.Caddyfile \
    --site http://update.ttpos.com \
    --shortlink-json tmp/prod-shortlink-dryrun/short-latest.json \
    --api-upstream api:9000 \
    --dashboard-upstream dashboard:3000 \
    --mcp-upstream none

  # Drift gate for cron/CI. Fetch the live host file first, then assert it still
  # matches this repo. Exits 2 (not 0) when it has drifted, so the caller fails.
  ./deploy/scripts/migrate-caddy-shortlinks.sh \
    --source-site update.ttpos.dev \
    --target tmp/prod-host.Caddyfile \
    --site http://update.ttpos.com \
    --api-upstream faynosync-prod-api:9000 \
    --dashboard-upstream faynosync-prod-dashboard:3000 \
    --mcp-upstream none \
    --validate none --check
USAGE
}

die() {
  echo "error: $*" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_caddyfile="${SOURCE_CADDYFILE:-"${script_dir}/../Caddyfile"}"
target_caddyfile="${TARGET_CADDYFILE:-/opt/caddy/Caddyfile}"
site="${CADDY_SITE:-update.ttpos.dev}"
source_site="${SOURCE_CADDY_SITE:-}"
output_path=""
shortlink_json=""
api_upstream=""
dashboard_upstream=""
mcp_upstream=""
validate_mode="${VALIDATE_MODE:-auto}"
caddy_container="${CADDY_CONTAINER:-caddy}"
container_config="${CONTAINER_CADDYFILE:-/etc/caddy/Caddyfile}"
apply=0
reload=0
check=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      source_caddyfile="${2:-}"
      shift 2
      ;;
    --target)
      target_caddyfile="${2:-}"
      shift 2
      ;;
    --site)
      site="${2:-}"
      shift 2
      ;;
    --source-site)
      source_site="${2:-}"
      shift 2
      ;;
    --output)
      output_path="${2:-}"
      shift 2
      ;;
    --shortlink-json)
      shortlink_json="${2:-}"
      shift 2
      ;;
    --api-upstream)
      api_upstream="${2:-}"
      shift 2
      ;;
    --dashboard-upstream)
      dashboard_upstream="${2:-}"
      shift 2
      ;;
    --mcp-upstream)
      mcp_upstream="${2:-}"
      shift 2
      ;;
    --validate)
      validate_mode="${2:-}"
      shift 2
      ;;
    --caddy-container)
      caddy_container="${2:-}"
      shift 2
      ;;
    --container-config)
      container_config="${2:-}"
      shift 2
      ;;
    --apply)
      apply=1
      shift
      ;;
    --reload)
      reload=1
      shift
      ;;
    --check)
      check=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -n "$source_caddyfile" ]] || die "--source cannot be empty"
[[ -n "$target_caddyfile" ]] || die "--target cannot be empty"
[[ -n "$site" ]] || die "--site cannot be empty"
if [[ -z "$source_site" ]]; then
  source_site="$site"
fi
[[ -n "$source_site" ]] || die "--source-site cannot be empty"
command -v python3 >/dev/null 2>&1 || die "python3 is required"
[[ -f "$source_caddyfile" ]] || die "source Caddyfile not found: $source_caddyfile"
[[ -f "$target_caddyfile" ]] || die "target Caddyfile not found: $target_caddyfile"
if [[ -n "$shortlink_json" && ! -f "$shortlink_json" ]]; then
  die "shortlink JSON not found: $shortlink_json"
fi

case "$validate_mode" in
  auto|container|binary|none) ;;
  *) die "--validate must be one of auto, container, binary, none" ;;
esac

if [[ $reload -eq 1 && $apply -ne 1 ]]; then
  die "--reload requires --apply"
fi

if [[ $check -eq 1 && $apply -eq 1 ]]; then
  die "--check cannot be combined with --apply"
fi

if [[ -z "$output_path" ]]; then
  output_path="$(mktemp -t caddy-shortlinks-candidate.XXXXXX)"
else
  mkdir -p "$(dirname "$output_path")"
fi

python3 - "$source_caddyfile" "$target_caddyfile" "$source_site" "$site" "$output_path" "$shortlink_json" "$api_upstream" "$dashboard_upstream" "$mcp_upstream" <<'PY'
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def find_site_block(text: str, site: str) -> tuple[int, int]:
    pattern = re.compile(r"(?m)^[ \t]*" + re.escape(site) + r"\s*\{")
    match = pattern.search(text)
    if not match:
        raise SystemExit(f"site block not found: {site}")

    depth = 0
    in_comment = False
    for index in range(match.start(), len(text)):
        char = text[index]
        if char == "\n":
            in_comment = False
        elif in_comment:
            continue
        elif char == "#":
            in_comment = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return match.start(), index + 1

    raise SystemExit(f"unterminated site block: {site}")


def rewrite_site_header(block: str, target_site: str) -> str:
    return re.sub(
        r"(?m)^([ \t]*)[^\s{]+\s*\{",
        lambda match: f"{match.group(1)}{target_site} {{",
        block,
        count=1,
    )


def rewrite_upstream(block: str, old: str, new: str) -> str:
    if not new:
        return block
    return block.replace(f"reverse_proxy {old}", f"reverse_proxy {new}")


def remove_handle_block(block: str, handle: str) -> str:
    pattern = re.compile(r"(?m)^[ \t]*handle\s+" + re.escape(handle) + r"\s*\{")
    match = pattern.search(block)
    if not match:
        return block

    remove_start = block.rfind("\n", 0, match.start()) + 1
    previous_end = remove_start
    while previous_end > 0:
        previous_start = block.rfind("\n", 0, previous_end - 1) + 1
        line = block[previous_start:previous_end]
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            remove_start = previous_start
            previous_end = previous_start
            continue
        break

    depth = 0
    in_comment = False
    for index in range(match.start(), len(block)):
        char = block[index]
        if char == "\n":
            in_comment = False
        elif in_comment:
            continue
        elif char == "#":
            in_comment = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                trailing_blank = re.match(r"\r?\n(?:[ \t]*\r?\n)*", block[end:])
                if trailing_blank:
                    end += trailing_blank.end()
                return block[:remove_start].rstrip() + "\n" + block[end:].lstrip("\n")

    raise SystemExit(f"unterminated handle block: {handle}")


def app_identifier(name: str) -> str:
    identifier = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return identifier


def parse_caddy_shortlink_map(block: str) -> dict[str, tuple[str, str, str, str]]:
    line_pattern = re.compile(
        r"(?m)^[ \t]*~\(\?i\)\^/dl/([a-z]+)\\\.(apk|exe|dmg)\$"
        r"\s+([a-z0-9_]+)\s+([a-z]+)\s+([a-z0-9]+)\s+([a-z]+)\s*$"
    )
    result: dict[str, tuple[str, str, str, str]] = {}
    for match in line_pattern.finditer(block):
        target = f"{match.group(1)}.{match.group(2)}"
        if target in result:
            raise SystemExit(f"duplicate Caddy /dl mapping: {target}")
        result[target] = (match.group(3), match.group(4), match.group(5), match.group(6))
    return result


def validate_shortlink_json(block: str, path: str) -> None:
    if not path:
        return

    catalog = json.loads(Path(path).read_text())
    owner = catalog.get("owner")
    channel = catalog.get("default_channel")
    aliases = catalog.get("aliases") or {}
    targets = catalog.get("targets") or {}
    if not owner or not channel or not aliases or not targets:
        raise SystemExit("shortlink JSON must include owner, default_channel, aliases, and targets")

    rewrite = (
        f"/apps/latest?owner={owner}&app_name={{short_latest_app}}"
        f"&channel={channel}&platform={{short_latest_platform}}"
        f"&arch={{short_latest_arch}}&package={{short_latest_package}}"
    )
    if rewrite not in block:
        raise SystemExit(f"Caddy rewrite does not match shortlink JSON owner/channel: {rewrite}")

    expected: dict[str, tuple[str, str, str, str]] = {}
    for alias, app_name in aliases.items():
        for extension, target in targets.items():
            expected[f"{alias}.{extension}"] = (
                app_identifier(app_name),
                target["platform"],
                target["arch"],
                target["package"],
            )

    actual = parse_caddy_shortlink_map(block)
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        changed = sorted(key for key in set(expected) & set(actual) if expected[key] != actual[key])
        details = []
        if missing:
            details.append(f"missing={missing}")
        if extra:
            details.append(f"extra={extra}")
        if changed:
            details.append(f"changed={[(key, actual[key], expected[key]) for key in changed]}")
        raise SystemExit("Caddy /dl map differs from shortlink JSON: " + "; ".join(details))

    print(f"shortlink-json: matched {len(actual)} alias/package mappings (owner={owner}, channel={channel})")


source_path, target_path, source_site, target_site, output_path, shortlink_json, api_upstream, dashboard_upstream, mcp_upstream = sys.argv[1:]
source = Path(source_path).read_text()
target = Path(target_path).read_text()

source_start, source_end = find_site_block(source, source_site)
target_start, target_end = find_site_block(target, target_site)
source_block = source[source_start:source_end].rstrip()

source_block = rewrite_site_header(source_block, target_site)
source_block = rewrite_upstream(source_block, "faynosync-api:9000", api_upstream)
source_block = rewrite_upstream(source_block, "faynosync-dashboard:3000", dashboard_upstream)
if mcp_upstream == "none":
    source_block = remove_handle_block(source_block, "/mcp*")
else:
    source_block = rewrite_upstream(source_block, "faynosync-mcp:3010", mcp_upstream)

validate_shortlink_json(source_block, shortlink_json)

candidate = target[:target_start].rstrip() + "\n\n" + source_block + "\n" + target[target_end:].lstrip("\n")
Path(output_path).write_text(candidate)
PY

validate_with_container() {
  command -v docker >/dev/null 2>&1 || return 1
  docker inspect "$caddy_container" >/dev/null 2>&1 || return 1

  local container_tmp="/tmp/caddy-shortlinks-candidate-$$.Caddyfile"
  docker cp "$output_path" "${caddy_container}:${container_tmp}" || return 1

  local status=0
  docker exec "$caddy_container" caddy validate --config "$container_tmp" || status=$?
  docker exec "$caddy_container" rm -f "$container_tmp" >/dev/null || true
  return "$status"
}

validate_with_binary() {
  command -v caddy >/dev/null 2>&1 || return 1
  caddy validate --config "$output_path"
}

case "$validate_mode" in
  none)
    echo "validation: skipped by --validate none"
    ;;
  container)
    validate_with_container || die "container validation failed; check container '$caddy_container'"
    ;;
  binary)
    validate_with_binary || die "binary validation failed; caddy not found or config invalid"
    ;;
  auto)
    if validate_with_container; then
      echo "validation: container '$caddy_container'"
    elif validate_with_binary; then
      echo "validation: local caddy binary"
    else
      die "no validator available; install caddy, run Docker Caddy container, or use --validate none for offline candidate generation"
    fi
    ;;
esac

echo "candidate: $output_path"

if cmp -s "$target_caddyfile" "$output_path"; then
  echo "result: target already matches candidate"
else
  echo "result: candidate differs from target"
fi

if [[ $check -eq 1 ]]; then
  # Drift gate. Whole-line comments carry no Caddy behavior and legitimately
  # differ per host (prod's /dl block was patched by hand and never picked up
  # this repo's explanatory comments), so a byte-exact gate would fail from day
  # one and get ignored. Compare functional lines only.
  drift="$(python3 - "$target_caddyfile" "$output_path" <<'PY'
from __future__ import annotations

import difflib
import sys
from pathlib import Path


def functional(path: str) -> list[str]:
    lines = []
    for raw in Path(path).read_text().splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        lines.append(stripped)
    return lines


target, candidate = sys.argv[1], sys.argv[2]
diff = difflib.unified_diff(
    functional(target),
    functional(candidate),
    fromfile="target",
    tofile="candidate",
    lineterm="",
)
sys.stdout.write("\n".join(diff))
PY
)"
  if [[ -n "$drift" ]]; then
    echo "check: FAILED — target has drifted from the repo-derived candidate"
    printf '%s\n' "$drift"
    exit 2
  fi
  echo "check: OK — target matches the candidate on every functional line"
  exit 0
fi

if [[ $apply -ne 1 ]]; then
  echo "dry-run: no files changed. Re-run with --apply --reload after review."
  exit 0
fi

backup_path="${target_caddyfile}.bak-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$target_caddyfile" "$backup_path"
cp "$output_path" "$target_caddyfile"
echo "backup: $backup_path"
echo "applied: $target_caddyfile"

if [[ $reload -eq 1 ]]; then
  if command -v docker >/dev/null 2>&1 && docker inspect "$caddy_container" >/dev/null 2>&1; then
    docker exec "$caddy_container" caddy reload --config "$container_config"
    echo "reloaded: container '$caddy_container' with $container_config"
  elif command -v caddy >/dev/null 2>&1; then
    caddy reload --config "$target_caddyfile"
    echo "reloaded: local caddy binary with $target_caddyfile"
  else
    die "applied but could not reload; reload Caddy manually"
  fi
fi
