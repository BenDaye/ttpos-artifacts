package catalog

import (
	"context"
	db "faynoSync/mongod"
	"faynoSync/server/model"
	"faynoSync/server/ownership"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func GetAppByName(c *gin.Context, repository db.AppRepository) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	owner := ownership.Owner()

	//get parameters
	appName := c.Query("app_name")

	// Get filter parameters
	filters := make(map[string]interface{})
	if channel := c.Query("channel"); channel != "" {
		filters["channel"] = channel
	}
	if published := c.Query("published"); published != "" {
		if publishedBool, err := strconv.ParseBool(published); err == nil {
			filters["published"] = publishedBool
		}
	}
	if critical := c.Query("critical"); critical != "" {
		if criticalBool, err := strconv.ParseBool(critical); err == nil {
			filters["critical"] = criticalBool
		}
	}
	if platform := c.Query("platform"); platform != "" {
		filters["platform"] = platform
	}
	if arch := c.Query("arch"); arch != "" {
		filters["arch"] = arch
	}

	page := int64(1) // default value
	if pageStr := c.Query("page"); pageStr != "" {
		if parsedPage, err := strconv.ParseInt(pageStr, 10, 64); err == nil && parsedPage > 0 {
			page = parsedPage
		}
	}

	limit := int64(9) // default value
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.ParseInt(limitStr, 10, 64); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			if limit > 1000 {
				limit = 1000
			}
		}
	}

	//request on repository
	result, err := repository.GetAppByName(appName, ctx, page, limit, owner, filters)
	if err != nil {
		logrus.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch application data"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetAllApps(c *gin.Context, repository db.AppRepository) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	owner := ownership.Owner()

	var appList []*model.SpecificAppWithoutIDs

	//get limit parameter
	limit := int64(100) // default value
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.ParseInt(limitStr, 10, 64); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			if limit > 1000 {
				limit = 1000
			}
		}
	}

	//request on repository
	if result, err := repository.Get(ctx, limit, owner); err != nil {
		logrus.Error(err)
	} else {
		appList = result
	}

	c.JSON(http.StatusOK, gin.H{"apps": &appList})
}
