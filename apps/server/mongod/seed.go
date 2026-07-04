package mongod

import (
	"context"
	"strings"

	"faynoSync/server/model"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var seedChannels = []string{"prod", "test", "dev"}

var seedPlatforms = []string{"android", "ios", "windows", "macos"}

var seedArchitectures = []string{"amd64", "arm64"}

// resolveOwner determines the actual owner for seed data.
// Priority: explicit SEED_OWNER (must exist) > sole admin auto-detect.
// It deliberately refuses to guess when SEED_OWNER is unset and more than one
// admin exists: a non-deterministic "first admin" pick previously seeded a full
// metadata set under the wrong owner. Returns empty string (caller aborts) on
// any unresolved case, after logging the specific reason.
func resolveOwner(database *mongo.Database, ctx context.Context, seedOwner string) string {
	adminsCol := database.Collection("admins")

	// Explicit owner always wins, but must exist in the admins collection.
	if seedOwner != "" {
		if err := adminsCol.FindOne(ctx, bson.M{"username": seedOwner}).Err(); err != nil {
			logrus.Errorf("[seed] SEED_OWNER=%q not found in admins collection; aborting", seedOwner)
			return ""
		}
		return seedOwner
	}

	// No explicit owner: only auto-detect when exactly one admin exists.
	adminFilter := bson.M{"username": bson.M{"$exists": true}}
	count, err := adminsCol.CountDocuments(ctx, adminFilter)
	if err != nil {
		logrus.Errorf("[seed] failed to count admin users: %v", err)
		return ""
	}
	switch {
	case count == 0:
		return ""
	case count > 1:
		logrus.Errorf("[seed] %d admin users found and SEED_OWNER is unset; refusing to guess. Set SEED_OWNER explicitly.", count)
		return ""
	}

	var admin struct {
		Username string `bson:"username"`
	}
	if err := adminsCol.FindOne(ctx, adminFilter).Decode(&admin); err != nil {
		logrus.Errorf("[seed] failed to load the sole admin user: %v", err)
		return ""
	}
	logrus.Infof("[seed] auto-detected sole admin owner: %s", admin.Username)
	return admin.Username
}

// RunSeed populates the database with generic initial metadata: channels,
// platforms, and architectures. It deliberately does NOT seed any concrete
// applications — those are deployment-specific and must be created explicitly
// (via the API/dashboard) to avoid baking product data into the server and to
// prevent re-runs from splattering a fixed app catalog across owners.
// It is idempotent: existing items are skipped without error.
// The database parameter is used to validate/auto-detect the owner from admins collection.
func RunSeed(repo AppRepository, database *mongo.Database, ctx context.Context, seedOwner string) {
	logrus.Infoln("=== Running data seed ===")

	owner := resolveOwner(database, ctx, seedOwner)
	if owner == "" {
		logrus.Errorln("[seed] aborted: could not determine a seed owner (see reason above). Ensure an admin exists via /signup and set SEED_OWNER when multiple admins are present.")
		return
	}
	logrus.Infof("[seed] using owner: %s", owner)

	for _, ch := range seedChannels {
		_, err := repo.CreateChannel(ch, owner, ctx)
		if err != nil {
			if isAlreadyExists(err) {
				logrus.Infof("[seed] channel %q already exists, skipping", ch)
			} else {
				logrus.Errorf("[seed] failed to create channel %q: %v", ch, err)
			}
			continue
		}
		logrus.Infof("[seed] created channel: %s", ch)
	}

	for _, pl := range seedPlatforms {
		defaultUpdaters := []model.Updater{{Type: "manual", Default: true}}
		_, err := repo.CreatePlatform(pl, defaultUpdaters, owner, ctx)
		if err != nil {
			if isAlreadyExists(err) {
				logrus.Infof("[seed] platform %q already exists, skipping", pl)
			} else {
				logrus.Errorf("[seed] failed to create platform %q: %v", pl, err)
			}
			continue
		}
		logrus.Infof("[seed] created platform: %s", pl)
	}

	for _, arch := range seedArchitectures {
		_, err := repo.CreateArch(arch, owner, ctx)
		if err != nil {
			if isAlreadyExists(err) {
				logrus.Infof("[seed] architecture %q already exists, skipping", arch)
			} else {
				logrus.Errorf("[seed] failed to create architecture %q: %v", arch, err)
			}
			continue
		}
		logrus.Infof("[seed] created architecture: %s", arch)
	}

	logrus.Infoln("=== Data seed complete ===")
}

func isAlreadyExists(err error) bool {
	return strings.Contains(err.Error(), "already exists")
}
