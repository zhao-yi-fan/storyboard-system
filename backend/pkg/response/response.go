package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Code    int         `json:"code"`
	Data    interface{} `json:"data"`
	Message string      `json:"message"`
}

// Success 返回成功响应 (code=200)
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    200,
		Data:    data,
		Message: "",
	})
}

// Created 返回创建成功响应 (code=200 保持一致)
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    200,
		Data:    data,
		Message: "",
	})
}

// Error 返回失败响应 (code=0)
func Error(c *gin.Context, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Data:    nil,
		Message: message,
	})
}
