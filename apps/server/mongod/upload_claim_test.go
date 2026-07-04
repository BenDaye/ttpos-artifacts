package mongod

import (
	"errors"
	"reflect"
	"testing"

	"faynoSync/server/model"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func TestUploadClaimIDIncludesArtifactTuple(t *testing.T) {
	appID := primitive.NewObjectID()
	channelID := primitive.NewObjectID()
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()

	apkClaim := buildUploadClaimID("owner", appID, "1.2.3", channelID, platformID, archID, ".apk")
	pkgClaim := buildUploadClaimID("owner", appID, "1.2.3", channelID, platformID, archID, ".pkg")

	if apkClaim == pkgClaim {
		t.Fatal("expected different package extensions to produce different upload claims")
	}
}

func TestUploadClaimDuplicateKeyMapsToArtifactConflict(t *testing.T) {
	err := uploadClaimConflictError(mongo.WriteException{
		WriteErrors: []mongo.WriteError{{
			Code: 11000,
		}},
	})

	if !errors.Is(err, ErrUploadArtifactAlreadyExists) {
		t.Fatalf("expected duplicate upload claim to map to ErrUploadArtifactAlreadyExists, got %v", err)
	}
}

func TestAppendArtifactFilterRejectsExistingTuple(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()
	baseFilter := bson.D{{Key: "owner", Value: "admin"}}
	artifact := model.Artifact{
		Platform: platformID,
		Arch:     archID,
		Package:  ".apk",
	}

	filter := appendArtifactFilter(baseFilter, artifact)
	wantTupleGuard := bson.E{Key: "artifacts", Value: bson.M{
		"$not": bson.M{"$elemMatch": bson.M{
			"platform": platformID,
			"arch":     archID,
			"package":  ".apk",
		}},
	}}

	if len(filter) != 2 {
		t.Fatalf("expected base filter plus tuple guard, got %#v", filter)
	}
	if !reflect.DeepEqual(filter[1], wantTupleGuard) {
		t.Fatalf("expected tuple guard %#v, got %#v", wantTupleGuard, filter[1])
	}
}
