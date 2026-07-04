package redisdb

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

var client *redis.Client

func ConnectToRedis(config RedisConfig) (*redis.Client, error) {
	if client != nil {
		return client, nil
	}

	options := &redis.Options{
		Addr:     config.Addr,
		Password: config.Password,
		DB:       config.DB,
	}

	client = redis.NewClient(options)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := client.Ping(ctx).Result()
	if err != nil {
		client = nil
		return nil, err
	}

	logrus.Infoln("Connected to Redis successfully")
	return client, nil
}
