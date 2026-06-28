package utils

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"faynoSync/server/utils/updaters"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

// getContentType 按文件名后缀推断上传到对象存储时应写入的 Content-Type。
// 安装包(.apk/.exe 等)必须显式指定:留空会让 GCS/S3 按内容嗅探,而 APK、IPA
// 本质是 ZIP 容器(魔数 PK\x03\x04),会被嗅探成 application/zip,导致手机/浏览器
// 当压缩包下载而非可安装包。返回空串表示交由存储后端按默认行为处理。
func getContentType(fileName string) string {
	fileName = strings.ToLower(fileName)

	if fileName == "releases" {
		return "text/plain"
	}

	switch {
	case strings.HasSuffix(fileName, ".yaml"), strings.HasSuffix(fileName, ".yml"):
		return "text/yaml"
	case strings.HasSuffix(fileName, ".apk"):
		// Android 包安装器依赖此 MIME 判定为可安装包;留空/zip 会被当压缩包。
		return "application/vnd.android.package-archive"
	case strings.HasSuffix(fileName, ".exe"),
		strings.HasSuffix(fileName, ".msi"),
		strings.HasSuffix(fileName, ".dmg"),
		strings.HasSuffix(fileName, ".pkg"),
		strings.HasSuffix(fileName, ".ipa"):
		// 桌面/iOS 安装包靠扩展名与魔数识别,不依赖 HTTP Content-Type;统一用通用
		// 二进制类型强制下载、避免被嗅探成 zip。octet-stream 是 nginx/IIS/Apple
		// 官方 mime.types 对这些后缀的实践取值,比 vendor-specific 值争议更小。
		return "application/octet-stream"
	}

	return ""
}

// getStorageClient creates and returns a storage client using the factory pattern
func getStorageClient(env *viper.Viper) (StorageClient, error) {
	factory := NewStorageFactory(env)
	return factory.CreateStorageClient()
}

func UploadLogo(appName string, owner string, file *multipart.FileHeader, c *gin.Context, env *viper.Viper) (string, error) {
	logoLink, _, err := UploadToS3(map[string]interface{}{
		"app_name": appName,
		"version":  "0.0.0",
		"type":     "logo",
		"channel":  "",
		"platform": "",
		"arch":     "",
	}, owner, file, c, env, true)
	return logoLink, err
}

func UploadToS3(ctxQuery map[string]interface{}, owner string, file *multipart.FileHeader, c *gin.Context, env *viper.Viper, checkAppVisibility bool) (string, string, error) {

	storageClient, err := getStorageClient(env)
	if err != nil {
		logrus.Errorf("failed to create storage client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create storage client"})
		return "", "", err
	}

	var extension string
	// Extract base filename and extension
	baseFileName := file.Filename
	lastDotIndex := strings.LastIndex(baseFileName, ".")
	if lastDotIndex > -1 {
		extension = baseFileName[lastDotIndex:]
	}
	// Generate new file name
	var newFileName string
	if ctxQuery["type"] == "logo" {
		newFileName = fmt.Sprintf("%s-logo%s", ctxQuery["app_name"].(string), extension)
	} else {
		newFileName = fmt.Sprintf("%s-%s%s", ctxQuery["app_name"].(string), ctxQuery["version"].(string), extension)
	}

	var link string
	var s3Key string

	// Add API_URL to ctxQuery for BuildS3Key function
	ctxQuery["api_url"] = env.GetString("API_URL")

	// Get updater type from context or use default
	updaterType := "default"
	if updaterTypeVal, exists := ctxQuery["updater"]; exists {
		updaterType = updaterTypeVal.(string)
	}

	// Build S3 key using updaters package
	link, s3Key = updaters.BuildS3Key(ctxQuery, owner, newFileName, file.Filename, updaterType)

	// Open the file for reading
	fileReader, err := file.Open()
	if err != nil {
		logrus.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file for reading"})
		return "", "", err
	}
	defer fileReader.Close()

	logrus.Debugf("Uploading file: key=%s, type=%s",
		s3Key, ctxQuery["type"])

	// Determine ContentType based on file name
	contentType := getContentType(file.Filename)
	logrus.Debugf("Determined ContentType: %s for file: %s", contentType, file.Filename)

	var bucketName string
	if ctxQuery["type"] == "logo" || checkAppVisibility == false {
		bucketName = env.GetString("S3_BUCKET_NAME")
		logrus.Debugf("Uploading file to public bucket: %s", bucketName)
		publicLink, err := storageClient.UploadPublicObject(c.Request.Context(), bucketName, s3Key, fileReader, contentType)
		if err != nil {
			logrus.Errorf("Failed to upload file to storage: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file to storage"})
			return "", "", err
		}
		logrus.Debugf("File uploaded successfully, public link: %s", publicLink)
		link = publicLink
	} else {
		// Use private bucket for regular uploads
		bucketName = env.GetString("S3_BUCKET_NAME_PRIVATE")
		logrus.Debugf("Uploading to private bucket: %s", bucketName)
		err = storageClient.UploadObject(c.Request.Context(), bucketName, s3Key, fileReader, contentType)
		if err != nil {
			logrus.Errorf("Failed to upload to private storage: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file to storage"})
			return "", "", err
		}
		logrus.Debugf("File uploaded successfully to private bucket")
	}

	return link, extension, nil
}

func DeleteFromS3(objectKey string, c *gin.Context, env *viper.Viper, private bool) {
	logrus.Debugf("DeleteFromS3 called with objectKey: %s, private: %v", objectKey, private)

	storageClient, err := getStorageClient(env)
	if err != nil {
		logrus.Errorf("failed to create storage client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create storage client"})
		return
	}

	objectKey = strings.TrimPrefix(objectKey, "/")
	decodedKey, err := url.QueryUnescape(objectKey)
	if err != nil {
		logrus.Error("Failed to decode object key: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode object key"})
		return
	}

	logrus.Debugf("decodedKey in delete from s3: %s", decodedKey)

	var bucketName string
	if private {
		bucketName = env.GetString("S3_BUCKET_NAME_PRIVATE")
		logrus.Debugf("Using private bucket: %s", bucketName)
	} else {
		bucketName = env.GetString("S3_BUCKET_NAME")
		logrus.Debugf("Using public bucket: %s", bucketName)
	}

	logrus.Debugf("Attempting to delete object '%s' from bucket '%s'", decodedKey, bucketName)
	err = storageClient.DeleteObject(context.Background(), bucketName, decodedKey)
	if err != nil {
		logrus.Errorf("Failed to delete object '%s' from bucket '%s': %v", decodedKey, bucketName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete file from storage"})
		return
	}

	logrus.Infof("Object '%s' deleted from bucket '%s'", decodedKey, bucketName)
}

func GeneratePresignedURL(c *gin.Context, objectKey string, expiration time.Duration) (string, error) {
	env := viper.GetViper()

	storageClient, err := getStorageClient(env)
	if err != nil {
		logrus.Errorf("failed to create storage client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create storage client"})
		return "", err
	}

	// Generate presigned URL
	url, err := storageClient.GeneratePresignedURL(c.Request.Context(), env.GetString("S3_BUCKET_NAME_PRIVATE"), objectKey, expiration)
	if err != nil {
		return "", err
	}

	return url, nil
}
