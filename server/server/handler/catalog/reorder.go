package catalog

import (
	"context"
	"errors"
	db "faynoSync/mongod"
	"faynoSync/server/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// reorderRequest 是四类 reorder 端点共用的请求体:目标顺序的 id 列表。
type reorderRequest struct {
	IDs []string `json:"ids"`
}

// metaReorderer 是 reorder 端点所需的最小仓储能力。
// 刻意不并入 db.AppRepository 大接口:否则所有实现者(含 TUF bootstrap 的测试 mock)
// 都会被迫同步新增方法。具体 *appRepository 实现了这些方法,运行时断言即可拿到。
type metaReorderer interface {
	ReorderChannels(ctx context.Context, owner string, ids []string) error
	ReorderPlatforms(ctx context.Context, owner string, ids []string) error
	ReorderArchs(ctx context.Context, owner string, ids []string) error
	ReorderApps(ctx context.Context, owner string, ids []string) error
}

// asReorderer 把仓储断言为 metaReorderer;失败时已写好 500 响应并返回 ok=false。
func asReorderer(c *gin.Context, repository db.AppRepository) (metaReorderer, bool) {
	r, ok := repository.(metaReorderer)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "reorder is not supported by this repository"})
	}
	return r, ok
}

// reorderErrorStatus 把仓储层的 sentinel error 映射为 HTTP 状态码:
// 输入类错误(非法/重复/未知 id)→ 400,其余 → 500。
func reorderErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrReorderInvalidID),
		errors.Is(err, db.ErrReorderDuplicateID),
		errors.Is(err, db.ErrReorderUnknownIDs):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// reorderHandler 是四类 reorder 端点的共用骨架,镜像本包 list.go 的风格。
func reorderHandler(c *gin.Context, fn func(ctx context.Context, owner string, ids []string) error) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	owner, err := utils.GetUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req reorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := fn(ctx, owner, req.IDs); err != nil {
		logrus.Error(err)
		c.JSON(reorderErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func ReorderChannels(c *gin.Context, repository db.AppRepository) {
	if r, ok := asReorderer(c, repository); ok {
		reorderHandler(c, r.ReorderChannels)
	}
}

func ReorderPlatforms(c *gin.Context, repository db.AppRepository) {
	if r, ok := asReorderer(c, repository); ok {
		reorderHandler(c, r.ReorderPlatforms)
	}
}

func ReorderArchs(c *gin.Context, repository db.AppRepository) {
	if r, ok := asReorderer(c, repository); ok {
		reorderHandler(c, r.ReorderArchs)
	}
}

func ReorderApps(c *gin.Context, repository db.AppRepository) {
	if r, ok := asReorderer(c, repository); ok {
		reorderHandler(c, r.ReorderApps)
	}
}
