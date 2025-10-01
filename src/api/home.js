// src/api/home.js
import request from '@/utils/request'

// ---- alarms ----

// 未处理告警（前3条 + 总数）
// 兼容后端常见分页参数：limit/skip
export function apiGetPendingAlarms (limit = 3) {
  return request({
    url: '/alarms',
    method: 'get',
    params: { alarm_status: 0, limit, skip: 0 }
  })
}

// 通用获取告警列表（用于前端自行做统计）
export function apiGetAlarms (params = {}) {
  return request({
    url: '/alarms',
    method: 'get',
    params
  })
}

// （可选）导出报表（若后端未提供该接口，可忽略前端导出按钮）
export function apiExportReport (start, end) {
  return request({
    url: '/alarms/export',
    method: 'get',
    responseType: 'blob',
    params: { start, end }
  })
}

// ---- cameras ----

// 获取摄像头信息（支持条件+分页）
export function apiGetCameraInfos (params = {}) {
  return request({
    url: '/cameraInfos',
    method: 'get',
    params
  })
}

// 离线摄像头列表
export function apiGetOfflineCameras () {
  return request({
    url: '/cameraInfos',
    method: 'get',
    params: { camera_status: 0, limit: 50, skip: 0 }
  })
}
