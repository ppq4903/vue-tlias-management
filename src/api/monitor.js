import request from '@/utils/request'

/**
 * 获取摄像头列表
 * 后端：GET /cameraInfos/?skip=&limit=   （无需手动加 api/v1，baseURL 里已有）
 */
export async function fetchCameraList () {
  const res = await request.get('/cameraInfos/', {
    params: { skip: 0, limit: 100000 }
  })
  const data = res?.data ?? res
  // 兼容 rows / list / data / 纯数组
  return data?.rows || data?.list || data?.data || data || []
}

/**
 * 轻量连通性测试（替代 ping）
 * 后端：GET /cameraInfos/test/{camera_id}
 */
export function fetchFramePing (cameraId) {
  return request.get(`/cameraInfos/test/${cameraId}`)
}

/**
 * 启动/停止安防分析（用于播放/暂停联动）
 * 后端：GET /safety_analysis/start/{camera_id}
 *      GET /safety_analysis/stop/{camera_id}
 */
export function startAnalysis (cameraId) {
  return request.get(`/safety_analysis/start/${cameraId}`)
}
export function stopAnalysis (cameraId) {
  return request.get(`/safety_analysis/stop/${cameraId}`)
}

/**
 * 截图（后端当前未提供；保留占位，调用时会给出友好提示）
 * 期望：GET /cameraInfos/{camera_id}/snapshot -> image/jpeg
 */
export async function requestSnapshot (cameraId) {
  const res = await request.get(`/cameraInfos/${cameraId}/snapshot`, {
    responseType: 'blob'
  })
  return (res?.data ?? res)
}
