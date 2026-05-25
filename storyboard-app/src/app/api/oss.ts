import { getApiBaseUrl } from "./client";

type OssUploadResponse = {
  code: number;
  data: {
    public_url: string;
    object_key: string;
  } | null;
  message: string;
};

export async function uploadFileToOss(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const uploadResponse = await fetch(`${getApiBaseUrl()}/oss/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const result = await uploadResponse.json() as OssUploadResponse;

  if (!uploadResponse.ok) {
    throw new Error(`上传文件失败: HTTP ${uploadResponse.status}`);
  }

  if (result.code !== 200 || !result.data?.public_url) {
    throw new Error(result.message || "上传文件失败");
  }

  return result.data.public_url;
}
