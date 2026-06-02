package storage

import (
	"errors"
	"fmt"
	"testing"

	"cloud.google.com/go/storage"
	"google.golang.org/api/googleapi"
)

func TestIsObjectNotFound(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil 不是 not-found", nil, false},
		{"ErrObjectNotExist 直接", storage.ErrObjectNotExist, true},
		{"ErrObjectNotExist 被包裹", fmt.Errorf("delete failed: %w", storage.ErrObjectNotExist), true},
		{"googleapi 404", &googleapi.Error{Code: 404, Message: "No such object"}, true},
		{"googleapi 404 被包裹", fmt.Errorf("gcs: %w", &googleapi.Error{Code: 404}), true},
		{"googleapi 500 不是 not-found", &googleapi.Error{Code: 500}, false},
		{"普通错误不是 not-found", errors.New("network down"), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isObjectNotFound(tc.err); got != tc.want {
				t.Fatalf("isObjectNotFound(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}
