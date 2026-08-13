package update

import "testing"

func TestShortLinkUpdate(t *testing.T) {
	t.Run("absent key leaves the stored value alone", func(t *testing.T) {
		if got := shortLinkUpdate(map[string]string{"app": "TTPOS"}); got != nil {
			t.Fatalf("shortLinkUpdate = %q, want nil", *got)
		}
	})

	t.Run("empty value clears the short link", func(t *testing.T) {
		got := shortLinkUpdate(map[string]string{"short_link": ""})
		if got == nil {
			t.Fatal("shortLinkUpdate = nil, want a pointer to the empty string")
		}
		if *got != "" {
			t.Fatalf("shortLinkUpdate = %q, want empty", *got)
		}
	})

	t.Run("value is normalized before storing", func(t *testing.T) {
		got := shortLinkUpdate(map[string]string{"short_link": "  Cashier "})
		if got == nil {
			t.Fatal("shortLinkUpdate = nil, want a pointer")
		}
		if *got != "cashier" {
			t.Fatalf("shortLinkUpdate = %q, want %q", *got, "cashier")
		}
	})
}
