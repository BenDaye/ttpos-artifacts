#!/bin/sh
set -e

# Replace the build-time API URL placeholder with the runtime value.
# This allows the same Docker image to be used with different API backends.
if [ -n "$VITE_API_URL" ]; then
  find /usr/share/nginx/html/assets -name '*.js' -exec \
    sed -i "s|__VITE_API_URL_PLACEHOLDER__|${VITE_API_URL}|g" {} +
fi

exec "$@"
