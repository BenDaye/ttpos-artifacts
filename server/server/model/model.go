package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Artifact struct {
	Link      string             `bson:"link"`
	Platform  primitive.ObjectID `bson:"platform"`
	Arch      primitive.ObjectID `bson:"arch"`
	Package   string             `bson:"package"`
	Signature string             `bson:"signature"`
	Hashes    map[string]string  `bson:"hashes,omitempty"`
	Length    int64              `bson:"length,omitempty"`
	TufSigned bool               `bson:"tuf_signed,omitempty"`
	TufTaskID *string            `bson:"tuf_task_id,omitempty"`
}

type App struct {
	ID          primitive.ObjectID `bson:"_id" json:"ID"`
	AppName     string             `bson:"app_name" json:"AppName"`
	Logo        string             `bson:"logo" json:"Logo"`
	Private     bool               `bson:"private" json:"-"`
	Tuf         bool               `bson:"tuf"`
	Description string             `bson:"description" json:"Description"`
	Owner       string             `bson:"owner" json:"-"`
	Updated_at  primitive.DateTime `bson:"updated_at" json:"Updated_at"`
}

type SpecificApp struct {
	ID           primitive.ObjectID `bson:"_id"`
	AppID        primitive.ObjectID `bson:"app_id"`
	AppName      string             `bson:"app_name,omitempty" json:"AppName,omitempty"`
	Version      string             `bson:"version"`
	ChannelID    primitive.ObjectID `bson:"channel_id"`
	Channel      string             `bson:"channel,omitempty" json:"channel,omitempty"`
	Published    bool               `bson:"published"`
	Critical     bool               `bson:"critical"`
	Intermediate bool               `bson:"required_intermediate"`
	Artifacts    []Artifact         `bson:"artifacts"`
	Changelog    []Changelog        `bson:"changelog"`
	Updated_at   primitive.DateTime `bson:"updated_at"`
	Owner        string             `bson:"owner"`
}

type SpecificArtifactsWithoutIDs struct {
	Link      string  `bson:"link" json:"link"`
	Platform  string  `bson:"platform" json:"platform"`
	Arch      string  `bson:"arch" json:"arch"`
	Package   string  `bson:"package" json:"package"`
	TufTaskID *string `bson:"tuf_task_id,omitempty"`
	TufSigned bool    `bson:"tuf_signed,omitempty"`
}

type SpecificAppWithoutIDs struct {
	ID           primitive.ObjectID            `bson:"_id,omitempty" json:"ID"`
	AppName      string                        `bson:"app_name" json:"AppName"`
	Version      string                        `bson:"version" json:"Version"`
	Channel      string                        `bson:"channel" json:"Channel"`
	Published    bool                          `bson:"published" json:"Published"`
	Critical     bool                          `bson:"critical" json:"Critical"`
	Intermediate bool                          `bson:"required_intermediate" json:"Intermediate"`
	Artifacts    []SpecificArtifactsWithoutIDs `bson:"artifacts" json:"Artifacts"`
	Changelog    []Changelog                   `bson:"changelog" json:"Changelog"`
	UpdatedAt    primitive.DateTime            `bson:"updated_at" json:"Updated_at"`
}

type Channel struct {
	ID          primitive.ObjectID `bson:"_id" json:"ID"`
	ChannelName string             `bson:"channel_name" json:"ChannelName"`
	Owner       string             `bson:"owner" json:"-"`
	Updated_at  primitive.DateTime `bson:"updated_at" json:"Updated_at"`
}

type Platform struct {
	ID           primitive.ObjectID `bson:"_id" json:"ID"`
	PlatformName string             `bson:"platform_name" json:"PlatformName"`
	Updaters     []Updater          `bson:"updaters" json:"Updaters"`
	Owner        string             `bson:"owner" json:"-"`
	Updated_at   primitive.DateTime `bson:"updated_at" json:"Updated_at"`
}

type Arch struct {
	ID         primitive.ObjectID `bson:"_id" json:"ID"`
	ArchID     string             `bson:"arch_id" json:"ArchID"`
	Owner      string             `bson:"owner" json:"-"`
	Updated_at primitive.DateTime `bson:"updated_at" json:"Updated_at"`
}

type Changelog struct {
	Version string `bson:"version"`
	Changes string `bson:"changes"`
	Date    string `bson:"date"`
}

type Credentials struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	SecretKey string `json:"api_key"`
}

type UpRequest struct {
	Id                string   `json:"id"`
	AppName           string   `json:"app_name"`
	Version           string   `json:"version"`
	Channel           string   `json:"channel"`
	Publish           bool     `json:"publish"`
	Critical          bool     `json:"critical"`
	Intermediate      bool     `json:"intermediate"`
	Platform          string   `json:"platform"`
	Arch              string   `json:"arch"`
	Changelog         string   `json:"changelog"`
	ArtifactsToDelete []string `json:"artifacts_to_delete"`
	Updater           string   `json:"updater"`
	Signature         string   `json:"signature"`
}

type PaginatedResponse struct {
	Items []*SpecificAppWithoutIDs `json:"items"`
	Total int64                    `json:"total"`
	Page  int64                    `json:"page"`
	Limit int64                    `json:"limit"`
}

type TeamUser struct {
	ID          primitive.ObjectID `bson:"_id"`
	Username    string             `bson:"username"`
	Password    string             `bson:"password"`
	Owner       string             `bson:"owner"`
	Permissions Permissions        `bson:"permissions"`
	Updated_at  primitive.DateTime `bson:"updated_at"`
}

type APIToken struct {
	ID          primitive.ObjectID `bson:"_id"`
	Name        string             `bson:"name"`
	TokenHash   string             `bson:"token_hash"`
	TokenPrefix string             `bson:"token_prefix"`
	Owner       string             `bson:"owner"`
	AllowedApps []string           `bson:"allowed_apps,omitempty"`
	ExpiresAt   *time.Time         `bson:"expires_at,omitempty"`
	CreatedAt   time.Time          `bson:"created_at"`
	LastUsedAt  *time.Time         `bson:"last_used_at,omitempty"`
}

type CreateAPITokenRequest struct {
	Name        string     `json:"name" binding:"required"`
	AllowedApps []string   `json:"allowed_apps" binding:"required,min=1"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

type DeleteAPITokenRequest struct {
	TokenID string `json:"id" binding:"required"`
}

type APITokenResponse struct {
	ID          primitive.ObjectID `json:"id"`
	Name        string             `json:"name"`
	TokenPrefix string             `json:"token_prefix"`
	AllowedApps []string           `json:"allowed_apps"`
	ExpiresAt   *time.Time         `json:"expires_at,omitempty"`
	CreatedAt   time.Time          `json:"created_at"`
	LastUsedAt  *time.Time         `json:"last_used_at,omitempty"`
}

type Permissions struct {
	Apps struct {
		Create   bool     `bson:"create" json:"Create"`
		Delete   bool     `bson:"delete" json:"Delete"`
		Edit     bool     `bson:"edit" json:"Edit"`
		Download bool     `bson:"download" json:"Download"`
		Upload   bool     `bson:"upload" json:"Upload"`
		Allowed  []string `bson:"allowed,omitempty" json:"Allowed"` // List of app IDs this user can access
	} `bson:"apps" json:"Apps"`
	Channels struct {
		Create  bool     `bson:"create" json:"Create"`
		Delete  bool     `bson:"delete" json:"Delete"`
		Edit    bool     `bson:"edit" json:"Edit"`
		Allowed []string `bson:"allowed,omitempty" json:"Allowed"` // List of channel IDs this user can access
	} `bson:"channels" json:"Channels"`
	Platforms struct {
		Create  bool     `bson:"create" json:"Create"`
		Delete  bool     `bson:"delete" json:"Delete"`
		Edit    bool     `bson:"edit" json:"Edit"`
		Allowed []string `bson:"allowed,omitempty" json:"Allowed"` // List of platform IDs this user can access
	} `bson:"platforms" json:"Platforms"`
	Archs struct {
		Create  bool     `bson:"create" json:"Create"`
		Delete  bool     `bson:"delete" json:"Delete"`
		Edit    bool     `bson:"edit" json:"Edit"`
		Allowed []string `bson:"allowed,omitempty" json:"Allowed"` // List of arch IDs this user can access
	} `bson:"archs" json:"Archs"`
}

type Updater struct {
	Type    string `bson:"type" json:"type"`
	Default bool   `bson:"default" json:"default"`
}

// Create request structures
type CreateChannelRequest struct {
	ChannelName string `json:"channel" binding:"required"`
}

type CreatePlatformRequest struct {
	PlatformName string    `json:"platform" binding:"required"`
	Updaters     []Updater `json:"updaters,omitempty"`
}

type CreateArchRequest struct {
	ArchID string `json:"arch" binding:"required"`
}

// Update request structures
type UpdateChannelRequest struct {
	ID          string `json:"id" binding:"required"`
	ChannelName string `json:"channel" binding:"required"`
}

type UpdatePlatformRequest struct {
	ID           string    `json:"id" binding:"required"`
	PlatformName string    `json:"platform" binding:"required"`
	Updaters     []Updater `json:"updaters" binding:"required"`
}

type UpdateArchRequest struct {
	ID     string `json:"id" binding:"required"`
	ArchID string `json:"arch" binding:"required"`
}
