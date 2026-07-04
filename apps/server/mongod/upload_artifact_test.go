package mongod

import (
	"errors"
	"testing"

	"faynoSync/server/model"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestApplyUploadedArtifactRejectsDuplicateWithoutOverwrite(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()
	appData := model.SpecificApp{
		Artifacts: []model.Artifact{{
			Link:      "old-link",
			Platform:  platformID,
			Arch:      archID,
			Package:   ".apk",
			Signature: "old-signature",
		}},
	}

	err := applyUploadedArtifact(&appData, model.Artifact{
		Link:      "new-link",
		Platform:  platformID,
		Arch:      archID,
		Package:   ".apk",
		Signature: "new-signature",
	}, false)

	if !errors.Is(err, ErrUploadArtifactAlreadyExists) {
		t.Fatalf("expected ErrUploadArtifactAlreadyExists, got %v", err)
	}
	if len(appData.Artifacts) != 1 {
		t.Fatalf("expected existing artifact list to stay length 1, got %d", len(appData.Artifacts))
	}
	if appData.Artifacts[0].Signature != "old-signature" {
		t.Fatalf("expected duplicate rejection to leave old artifact untouched, got %q", appData.Artifacts[0].Signature)
	}
}

func TestApplyUploadedArtifactOverwritesDuplicate(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()
	appData := model.SpecificApp{
		Artifacts: []model.Artifact{{
			Link:      "old-link",
			Platform:  platformID,
			Arch:      archID,
			Package:   ".apk",
			Signature: "old-signature",
		}},
	}

	err := applyUploadedArtifact(&appData, model.Artifact{
		Link:      "new-link",
		Platform:  platformID,
		Arch:      archID,
		Package:   ".apk",
		Signature: "new-signature",
		Hashes:    map[string]string{"sha256": "abc"},
		Length:    42,
	}, true)

	if err != nil {
		t.Fatalf("expected overwrite to succeed, got %v", err)
	}
	if len(appData.Artifacts) != 1 {
		t.Fatalf("expected overwrite to keep one artifact, got %d", len(appData.Artifacts))
	}
	got := appData.Artifacts[0]
	if got.Link != "new-link" || got.Signature != "new-signature" || got.Hashes["sha256"] != "abc" || got.Length != 42 {
		t.Fatalf("expected artifact to be replaced, got %+v", got)
	}
}

func TestApplyUploadedArtifactAppendsDifferentTuple(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()
	appData := model.SpecificApp{
		Artifacts: []model.Artifact{{
			Link:      "old-link",
			Platform:  platformID,
			Arch:      archID,
			Package:   ".apk",
			Signature: "old-signature",
		}},
	}

	err := applyUploadedArtifact(&appData, model.Artifact{
		Link:      "pkg-link",
		Platform:  platformID,
		Arch:      archID,
		Package:   ".pkg",
		Signature: "pkg-signature",
	}, false)

	if err != nil {
		t.Fatalf("expected different package to append, got %v", err)
	}
	if len(appData.Artifacts) != 2 {
		t.Fatalf("expected two artifacts, got %d", len(appData.Artifacts))
	}
}
