// src/api/alarm.js
import request from '@/utils/request'

/**
 * 获取告警列表 —— 返回“原始字符串”，页面负责美化与解析
 * GET /alarms/?start_time&end_time&alarm_type&alarm_status&skip&limit
 */
export function getAlarmsText(params) {
  return request({
    url: '/alarms/',
    method: 'get',
    params,
    transformResponse: [(data) => data] // 保留为字符串
  })
}

/** 批量删除 —— DELETE /alarms/{alarm_ids} */
export function deleteAlarms(ids) {
  const idsStr = Array.isArray(ids) ? ids.join(',') : String(ids || '')
  return request({
    url: `/alarms/${idsStr}`,
    method: 'delete'
  })
}

/** 处理记录列表 —— GET /alarm_handle_records/{alarm_id} */
export function getAlarmHandleRecords(alarmId) {
  return request({
    url: `/alarm_handle_records/${alarmId}`,
    method: 'get'
  })
}

/** 上传处理附件 —— POST /alarm_handle_records/upload_attachment */
export function uploadHandleAttachment(payload) {
  return request({
    url: '/alarm_handle_records/upload_attachment',
    method: 'post',
    data: payload
  })
}

/** 创建处理记录 —— POST /alarm_handle_records/ */
export function createAlarmHandleRecord(payload) {
  return request({
    url: '/alarm_handle_records/',
    method: 'post',
    data: payload
  })
}

/** 根据 camera_id 获取摄像头信息 —— GET /cameraInfos/{camera_id}
 */
export function getCameraInfo(cameraId) {
  return request({
    url: `/cameraInfos/${cameraId}`,
    method: 'get'
  })
}
