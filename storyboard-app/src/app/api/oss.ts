import { apiClient } from "./client";

type OssUploadResult = {
  public_url: string;
  object_key: string;
};

export async function uploadFileToOss(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const result = await apiClient.post<OssUploadResult>("/oss/upload", formData);
  if (!result.public_url) {
    throw new Error("上传文件失败");
  }

  return result.public_url;
}
