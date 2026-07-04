package sign

import (
	"context"
	"faynoSync/mongod"
	"faynoSync/server/model"
	"faynoSync/server/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func SignUp(c *gin.Context, database *mongo.Database, client *mongo.Client, apiKey string) {
	var creds model.Credentials
	if err := c.BindJSON(&creds); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if creds.SecretKey != apiKey {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "wrong api key"})
		return
	}

	if err := utils.ValidatePasswordStrength(creds.Password); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()
	// check the user credentials against the admins collection in MongoDB
	admins := database.Collection("admins")
	var result bson.M
	err := admins.FindOne(ctx, bson.M{"username": creds.Username}).Decode(&result)
	if err == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user already exists"})
		return
	}
	err = mongod.CreateUser(client, database, &creds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err})
	} else {
		c.JSON(http.StatusOK, gin.H{"result": "Successfully created admin user."})
	}
}
