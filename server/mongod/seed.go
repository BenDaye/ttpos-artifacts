package mongod

import (
	"context"
	"strings"

	"faynoSync/server/model"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type seedItem struct {
	Name        string
	Description string
}

var seedChannels = []string{"prod", "test", "dev"}

var seedPlatforms = []string{"android", "ios", "windows", "macos"}

var seedArchitectures = []string{"amd64", "arm64"}

var seedApps = []seedItem{
	{Name: "TTPOS", Description: "POS cashier application"},
	{Name: "TTPOS Go", Description: "POS assistant application"},
	{Name: "TTPOS Menu", Description: "Digital menu application"},
	{Name: "TTPOS Kitchen", Description: "Kitchen display system"},
	{Name: "TTPOS Kiosk", Description: "Self-service kiosk application"},
	{Name: "TTPOS Queue", Description: "Queue display system"},
	{Name: "TTPOS Shop", Description: "Shop management application"},
}

// resolveOwner determines the actual owner for seed data.
// Priority: explicit SEED_OWNER > first admin found in the database.
// Returns empty string if no valid owner can be determined.
func resolveOwner(database *mongo.Database, ctx context.Context, seedOwner string) string {
	adminsCol := database.Collection("admins")

	if seedOwner != "" {
		// Validate that the specified owner actually exists
		err := adminsCol.FindOne(ctx, bson.M{"username": seedOwner}).Err()
		if err == nil {
			return seedOwner
		}
		logrus.Warnf("[seed] SEED_OWNER=%q not found in admins collection", seedOwner)
	}

	// Auto-detect: pick the first admin user
	var admin struct {
		Username string `bson:"username"`
	}
	err := adminsCol.FindOne(ctx, bson.M{"username": bson.M{"$exists": true}}).Decode(&admin)
	if err != nil {
		return ""
	}
	logrus.Infof("[seed] auto-detected admin owner: %s", admin.Username)
	return admin.Username
}

// RunSeed populates the database with initial metadata.
// It is idempotent: existing items are skipped without error.
// The database parameter is used to validate/auto-detect the owner from admins collection.
func RunSeed(repo AppRepository, database *mongo.Database, ctx context.Context, seedOwner string) {
	logrus.Infoln("=== Running data seed ===")

	owner := resolveOwner(database, ctx, seedOwner)
	if owner == "" {
		logrus.Errorln("[seed] aborted: no admin user found. Register an admin via /signup first, then run -seed again.")
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

	for _, app := range seedApps {
		_, err := repo.CreateApp(app.Name, "", app.Description, false, false, owner, ctx)
		if err != nil {
			if isAlreadyExists(err) {
				logrus.Infof("[seed] app %q already exists, skipping", app.Name)
			} else {
				logrus.Errorf("[seed] failed to create app %q: %v", app.Name, err)
			}
			continue
		}
		logrus.Infof("[seed] created app: %s", app.Name)
	}

	logrus.Infoln("=== Data seed complete ===")
}

func isAlreadyExists(err error) bool {
	return strings.Contains(err.Error(), "already exists")
}
