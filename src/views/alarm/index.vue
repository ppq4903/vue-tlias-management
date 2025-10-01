<template>
  <div class="alarm-page">
    <!-- 筛选栏（无时间范围） -->
    <el-form :inline="true" :model="filters" class="filter-form">
      <el-form-item label="告警类型">
        <el-select v-model="filters.alarmType" placeholder="全部" clearable style="width: 140px">
          <el-option label="安全规范" :value="0" />
          <el-option label="区域入侵" :value="1" />
          <el-option label="火警" :value="2" />
        </el-select>
      </el-form-item>

      <el-form-item label="处理状态">
        <el-select v-model="filters.alarmStatus" placeholder="全部" clearable style="width: 140px">
          <el-option label="待处理" :value="0" />
          <el-option label="确认误报" :value="1" />
          <el-option label="处理中" :value="2" />
          <el-option label="已完成" :value="3" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="fetchAndRender()">查询</el-button>
        <el-button @click="resetFilters">重置筛选</el-button>
        <el-popconfirm title="确认删除勾选记录？" @confirm="batchDelete">
          <template #reference>
            <el-button type="danger">批量删除</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>

    <!-- 原始 JSON（自动美化 + 显示条数） -->
    <el-card class="json-card" v-if="rawJsonText">
      <template #header>
        <div class="json-header">
          <div class="json-title">原始 JSON（{{ jsonCount }} 条）</div>
          <el-button size="small" @click="copyRaw">复制 JSON</el-button>
        </div>
      </template>
      <el-input
        v-model="rawJsonText"
        type="textarea"
        :rows="14"
        class="json-textarea"
        readonly
      />
    </el-card>

    <!-- 告警表格（自动解析渲染） -->
    <el-table
      :data="alarmList"
      border
      stripe
      style="width: 100%"
      :row-class-name="rowClassName"
      @sort-change="onSortChange"
      @selection-change="onSelChange"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column prop="alarm_id" label="序号" width="90" />
      <el-table-column prop="alarm_time" label="触发时间" sortable="custom" min-width="160" />
      <el-table-column prop="park_area" label="园区区域" min-width="140" />
      <el-table-column prop="camera_name" label="摄像头名称" min-width="160" />

      <!-- 告警类型彩色标签 -->
      <el-table-column prop="alarm_type" label="告警类型" min-width="140">
        <template #default="{ row }">
          <el-tag class="tag type" :class="typeTagClass(row.alarm_type)" effect="plain">
            {{ formatType(null, null, row.alarm_type) }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 处理状态彩色标签 -->
      <el-table-column prop="alarm_status" label="处理状态" min-width="140">
        <template #default="{ row }">
          <el-tag class="tag status" :class="statusTagClass(row.alarm_status)" effect="plain">
            {{ formatStatus(null, null, row.alarm_status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="handler" label="处理人ID" min-width="120" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="scope">
          <el-button size="small" type="primary" @click="showDetail(scope.row)">查看详情</el-button>
          <el-button size="small" type="warning" @click="showHandle(scope.row)">处理</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <div>共 {{ pagination.total }} 条</div>
      <el-pagination
        background
        layout="prev, pager, next, jumper"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :current-page="pagination.pageNum"
        @current-change="onPageChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="告警详情" width="60%">
      <div v-if="currentAlarm">
        <p><b>时间：</b>{{ currentAlarm.alarm_time }}</p>
        <p><b>区域：</b>{{ currentAlarm.park_area || '-' }}</p>
        <p><b>摄像头：</b>{{ currentAlarm.camera_name || currentAlarm.camera_id }}</p>
        <img :src="currentAlarm.snapshot_url" alt="snapshot" class="shot" />
        <video v-if="currentAlarm.video_url" controls class="video">
          <source :src="currentAlarm.video_url" type="video/mp4" />
        </video>

        <h4>处理记录</h4>
        <el-table :data="handleRecords" border>
          <el-table-column prop="handle_time" label="时间" min-width="160" />
          <el-table-column prop="handler_user_id" label="处理人ID" min-width="120" />
          <el-table-column prop="handle_action" label="动作" :formatter="formatAction" min-width="120" />
          <el-table-column prop="handle_content" label="详情" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 处理弹窗 -->
    <el-dialog v-model="handleVisible" title="处理告警" width="520px">
      <el-form :model="handleForm" label-width="110px">
        <el-form-item label="处理动作">
          <el-select v-model="handleForm.handle_action" @change="fillDefaultContent">
            <el-option label="标记误报" :value="0" />
            <el-option label="派单处理" :value="1" />
            <el-option label="标记已解决" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="派遣操作员" v-if="handleForm.handle_action === 1">
          <el-input v-model="handleForm.handler_user_id" placeholder="请输入操作员ID（必填）" />
        </el-form-item>
        <el-form-item label="处理详情">
          <el-input v-model="handleForm.handle_content" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload
            action=""
            :on-change="handleFileChange"
            :auto-upload="false"
          >
            <el-button>选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">选文件后先上传至服务器得到 URL，再随处理记录一并提交</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  getAlarmsText,
  getAlarmHandleRecords,
  uploadHandleAttachment,
  createAlarmHandleRecord,
  deleteAlarms,
  getCameraInfo
} from '@/api/alarm'

export default {
  name: 'AlarmIndex',
  data() {
    return {
      currentUserId: 1, // 真实项目可替换为登录态用户ID
      filters: { alarmType: undefined, alarmStatus: undefined },

      rawJsonText: '',
      jsonCount: 0,
      parsedObject: null,

      alarmList: [],
      selection: [],
      cameraCache: {},

      pagination: {
        pageNum: 1,
        pageSize: 10,
        total: 0,
        sortProp: 'alarm_time',
        sortOrder: 'descending'
      },

      detailVisible: false,
      handleVisible: false,
      currentAlarm: null,
      handleRecords: [],
      handleForm: {
        alarm_id: null,
        handle_action: 0,
        handler_user_id: '',
        handle_content: '',
        handle_attachment_url: ''
      }
    }
  },
  methods: {
    async fetchAndRender(all = false) {
      try {
        const params = this.buildQueryParams(all)
        const res = await getAlarmsText(params)
        const text = typeof res === 'string' ? res : JSON.stringify(res || {}, null, 2)

        const { pretty, count } = this.prettifyJsonWithCount(text)
        this.rawJsonText = pretty
        this.jsonCount = count

        await this.parseAndFill(this.rawJsonText)
      } catch (e) {
        const status = e?.response?.status
        this.$message.error(`接口访问异常，Status：${status || '未知'} 获取告警数据失败`)
        console.error('fetchAndRender error:', e)
      }
    },

    prettifyJsonWithCount(text) {
      try {
        const obj = typeof text === 'string' ? JSON.parse(text) : text
        const data = obj?.data ?? obj
        let count = 0
        if (Array.isArray(data)) count = data.length
        else if (Array.isArray(data?.rows)) count = data.rows.length
        const pretty = JSON.stringify(obj, null, 2)
        return { pretty, count }
      } catch {
        return { pretty: text || '', count: 0 }
      }
    },

    async parseAndFill(text) {
      try {
        const obj = JSON.parse(text)
        this.parsedObject = obj
        const data = obj?.data ?? obj
        const rows = (data?.rows ?? (Array.isArray(data) ? data : [])).slice()
        const total = data?.total ?? rows.length

        await this.enrichRows(rows)

        const sorted = this.sortRows(rows, this.pagination.sortProp, this.pagination.sortOrder)
        this.pagination.total = total
        this.pagination.pageNum = 1
        this.alarmList = this.pageSlice(sorted)
      } catch (e) {
        this.$message.error('JSON 解析失败，请检查格式')
      }
    },

    async enrichRows(rows) {
      const tasks = rows.map(async (row) => {
        const camId = row.camera_id
        if (camId && !this.cameraCache[camId]) {
          try {
            const cam = await getCameraInfo(camId)
            const camObj = cam?.data || cam || {}
            this.cameraCache[camId] = {
              camera_name: camObj.camera_name || '',
              park_area: camObj.park_area || ''
            }
          } catch {
            this.cameraCache[camId] = { camera_name: '', park_area: '' }
          }
        }
        const camInfo = this.cameraCache[camId] || {}
        row.camera_name = row.camera_name || camInfo.camera_name
        row.park_area  = row.park_area  || camInfo.park_area

        try {
          const rec = await getAlarmHandleRecords(row.alarm_id)
          const list = Array.isArray(rec) ? rec : (rec?.data || [])
          if (list.length > 0) {
            list.sort((a, b) => new Date(b.handle_time).getTime() - new Date(a.handle_time).getTime())
            row.handler = list[0].handler_user_id || ''
          } else {
            row.handler = ''
          }
        } catch {
          row.handler = ''
        }
      })
      await Promise.all(tasks)
    },

    async copyRaw() {
      try {
        await navigator.clipboard.writeText(this.rawJsonText || '')
        this.$message.success('已复制')
      } catch {
        this.$message.warning('复制失败，请手动选择文本复制')
      }
    },

    buildQueryParams(all = false) {
      const params = {}
      if (this.filters.alarmType !== undefined && this.filters.alarmType !== null) params.alarm_type = this.filters.alarmType
      if (this.filters.alarmStatus !== undefined && this.filters.alarmStatus !== null) params.alarm_status = this.filters.alarmStatus
      if (!all) {
        params.skip = (this.pagination.pageNum - 1) * this.pagination.pageSize
        params.limit = this.pagination.pageSize
      }
      return params
    },

    async resetFilters() {
      this.filters = { alarmType: undefined, alarmStatus: undefined }
      await this.fetchAndRender(true) // 拉全量
    },

    async showDetail(row) {
      try {
        this.currentAlarm = { ...row }
        const resp = await getAlarmHandleRecords(row.alarm_id)
        this.handleRecords = Array.isArray(resp) ? resp : (resp?.data || [])
        this.detailVisible = true
      } catch (e) {
        this.$message.error('获取处理记录失败')
      }
    },

    showHandle(row) {
      this.handleForm.alarm_id = row.alarm_id
      this.handleForm.handle_action = 0
      this.handleForm.handler_user_id = ''
      this.handleForm.handle_attachment_url = ''
      this.fillDefaultContent()
      this.handleVisible = true
    },

    async handleFileChange(file) {
      const base64 = await this.fileToBase64(file.raw)
      const ext = (file.name || '').split('.').pop() || 'bin'
      try {
        const res = await uploadHandleAttachment({
          file_content: base64.replace(/^data:.*?;base64,/, ''),
          file_extension: ext
        })
        const url = res?.data
        if (url) {
          this.handleForm.handle_attachment_url = url
          this.$message.success('附件上传成功')
        } else {
          this.$message.warning('附件上传返回为空')
        }
      } catch (e) {
        this.$message.error('附件上传失败')
      }
    },
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    fillDefaultContent() {
      const map = {
        0: '标记为误报：经核实非有效告警。',
        1: '已派单，请操作员尽快到场处理。',
        2: '已现场确认：问题已解决，上传了处理附件（如有）。'
      }
      this.handleForm.handle_content = map[this.handleForm.handle_action] || ''
    },

    async submitHandle() {
      try {
        const payload = { ...this.handleForm }
        payload.alarm_id = Number(payload.alarm_id)

        if (payload.handle_action === 1) {
          if (payload.handler_user_id === '' || payload.handler_user_id === null || payload.handler_user_id === undefined) {
            this.$message.error('派单处理需要指定“派遣操作员ID”')
            return
          }
        }
        if (payload.handler_user_id === '' || payload.handler_user_id === null || payload.handler_user_id === undefined) {
          payload.handler_user_id = this.currentUserId
        }
        payload.handler_user_id = Number(payload.handler_user_id)

        if (!payload.handle_attachment_url) delete payload.handle_attachment_url

        await createAlarmHandleRecord(payload)
        this.$message.success('处理提交成功')
        this.handleVisible = false
        await this.fetchAndRender() // 刷新
      } catch (e) {
        const status = e?.response?.status
        this.$message.error(`提交处理失败（${status || '未知'}）`)
        console.error('submitHandle error:', e)
      }
    },

    async batchDelete() {
      if (!this.selection.length) {
        this.$message.warning('请先勾选要删除的记录')
        return
      }
      try {
        const ids = this.selection.map(i => i.alarm_id)
        await deleteAlarms(ids)
        this.$message.success('删除成功')
        await this.fetchAndRender()
      } catch (e) {
        this.$message.error('删除失败')
      }
    },
    onSelChange(list) { this.selection = list || [] },

    onPageChange(page) {
      this.pagination.pageNum = page
      if (!this.parsedObject) return
      const data = this.parsedObject?.data ?? this.parsedObject
      const rows = data?.rows ?? (Array.isArray(data) ? data : [])
      const sorted = this.sortRows(rows, this.pagination.sortProp, this.pagination.sortOrder)
      this.alarmList = this.pageSlice(sorted)
    },
    onSortChange({ prop, order }) {
      this.pagination.sortProp = prop
      this.pagination.sortOrder = order
      if (!this.parsedObject) return
      const data = this.parsedObject?.data ?? this.parsedObject
      const rows = data?.rows ?? (Array.isArray(data) ? data : [])
      const sorted = this.sortRows(rows, prop, order)
      this.alarmList = this.pageSlice(sorted)
    },
    sortRows(rows, prop, order) {
      if (!prop || !order) return rows.slice()
      const list = rows.slice()
      const factor = order === 'ascending' ? 1 : -1
      return list.sort((a, b) => {
        const va = a[prop]; const vb = b[prop]
        if (prop === 'alarm_time') {
          const ta = new Date(va || 0).getTime()
          const tb = new Date(vb || 0).getTime()
          return (ta - tb) * factor
        }
        if (va === vb) return 0
        return (va > vb ? 1 : -1) * factor
      })
    },
    pageSlice(rows) {
      const start = (this.pagination.pageNum - 1) * this.pagination.pageSize
      return rows.slice(start, start + this.pagination.pageSize)
    },

    // 行底色（四种状态）
    rowClassName({ row }) {
      switch (row.alarm_status) {
        case 0: return 'row-danger'  // 待处理-红
        case 1: return 'row-info'    // 误报-蓝
        case 2: return 'row-warning' // 处理中-黄
        case 3: return 'row-success' // 完成-绿
        default: return ''
      }
    },

    // —— 标签样式 —— //
    statusTagClass(status) {
      return {
        0: 'tag-danger', // 红
        1: 'tag-info',   // 蓝
        2: 'tag-warning',// 黄
        3: 'tag-success' // 绿
      }[status] || ''
    },
    typeTagClass(t) {
      // 0: 安全规范(紫), 1: 区域入侵(橙), 2: 火警(红)
      return {
        0: 'tag-safe',      // 紫
        1: 'tag-intrusion', // 橙
        2: 'tag-fire'       // 红
      }[t] || ''
    },

    // —— 文案映射 —— //
    formatStatus(row, col, val) {
      const map = { 0: '待处理', 1: '确认误报', 2: '处理中', 3: '已完成' }
      return map[val] ?? val
    },
    formatType(row, col, val) {
      const map = { 0: '安全规范', 1: '区域入侵', 2: '火警' }
      return map[val] ?? val
    },
    formatAction(row, col, val) {
      const map = { 0: '标记误报', 1: '派单处理', 2: '标记已解决' }
      return map[val] ?? val
    }
  },
  mounted() {
    this.fetchAndRender()
  }
}
</script>

<style scoped>
.alarm-page { padding: 20px; }
.filter-form { margin-bottom: 16px; }

/* JSON 区域 */
.json-card { margin-bottom: 16px; }
.json-header { display: flex; align-items: center; justify-content: space-between; }
.json-title { font-weight: 600; }
.json-textarea ::v-deep .el-textarea__inner {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* 详情媒体 */
.shot { max-width: 100%; margin: 10px 0; }
.video { width: 100%; }

/* 表尾 */
.table-footer {
  display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
}

/* —— 行底色（状态） —— */
.el-table .row-danger td  { background: #fff1f0 !important; } /* 红：待处理 */
.el-table .row-warning td { background: #fff7e6 !important; } /* 黄：处理中 */
.el-table .row-info td    { background: #e6f4ff !important; } /* 蓝：误报 */
.el-table .row-success td { background: #f6ffed !important; } /* 绿：完成 */

/* —— 标签配色（更柔和） —— */
.tag { border-width: 1px; }

/* 状态标签 */
.tag-danger  { color: #a8071a; border-color: #ffa39e; background: #fff1f0; }
.tag-warning { color: #ad6800; border-color: #ffd591; background: #fff7e6; }
.tag-info    { color: #0958d9; border-color: #91caff; background: #e6f4ff; }
.tag-success { color: #237804; border-color: #b7eb8f; background: #f6ffed; }

/* 类型标签 */
.tag-safe      { color: #531dab; border-color: #d3adf7; background: #f9f0ff; } /* 安全规范-紫 */
.tag-fire      { color: #a8071a; border-color: #ffa39e; background: #fff1f0; } /* 火警-红 */
.tag-intrusion { color: #d46b08; border-color: #ffd591; background: #fff7e6; } /* 区域入侵-橙 */
</style>
