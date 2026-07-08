package build

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Regression: the workflow_dispatch `ref` must be the workflow-holding ref in
// THIS repo (WorkflowRef, e.g. "main"), NOT the source branch to build (which
// is a ttpos-flutter branch and travels only in inputs.branch). Passing a source
// branch like "new-test" as ref makes GitHub reject the dispatch (no such ref in
// this repo).
func TestDispatchUsesWorkflowRefNotSourceBranch(t *testing.T) {
	var gotRef, gotBranchInput, gotEnv string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Ref    string            `json:"ref"`
			Inputs map[string]string `json:"inputs"`
		}
		_ = json.Unmarshal(body, &payload)
		gotRef = payload.Ref
		gotBranchInput = payload.Inputs["branch"]
		gotEnv = payload.Inputs["env"]
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"html_url":"https://github.com/o/r/actions/runs/1"}`))
	}))
	defer srv.Close()

	d := &githubDispatcher{
		cfg: Config{
			Token:        "pat",
			Owner:        "o",
			Repo:         "r",
			WorkflowFile: "auto-build.yaml",
			WorkflowRef:  "main",
		},
		httpClient: srv.Client(),
		apiBase:    srv.URL,
	}

	runURL, err := d.Dispatch(context.Background(), DispatchInput{
		Package:       "pos",
		Platform:      "android",
		Branch:        "new-test", // source branch (ttpos-flutter)
		Env:           EnvTest,
		CorrelationID: "abc123",
	})
	if err != nil {
		t.Fatalf("dispatch error: %v", err)
	}
	if gotRef != "main" {
		t.Errorf("dispatch ref = %q, want \"main\" (workflow ref, not source branch)", gotRef)
	}
	if gotBranchInput != "new-test" {
		t.Errorf("inputs.branch = %q, want \"new-test\" (source branch)", gotBranchInput)
	}
	if gotEnv != "test" {
		t.Errorf("inputs.env = %q, want \"test\"", gotEnv)
	}
	if runURL == "" {
		t.Error("expected run_url parsed from return_run_details response")
	}
}

// WorkflowRef defaults to main when unset.
func TestDispatchWorkflowRefDefaultsMain(t *testing.T) {
	var gotRef string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Ref string `json:"ref"`
		}
		_ = json.Unmarshal(body, &payload)
		gotRef = payload.Ref
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"html_url":"https://x/runs/1"}`))
	}))
	defer srv.Close()

	d := &githubDispatcher{
		cfg:        Config{Token: "pat", Owner: "o", Repo: "r", WorkflowFile: "auto-build.yaml"}, // WorkflowRef empty
		httpClient: srv.Client(),
		apiBase:    srv.URL,
	}
	if _, err := d.Dispatch(context.Background(), DispatchInput{Package: "pos", Platform: "android", Branch: "release", Env: EnvTest}); err != nil {
		t.Fatalf("dispatch error: %v", err)
	}
	if gotRef != "main" {
		t.Errorf("ref = %q, want \"main\" default", gotRef)
	}
}
