<template>
  <div class="page-wrap">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增摄像头</el-button>
      <el-button type="danger" plain :disabled="!multipleSelection.length" @click="handleBatchDelete">
        批量删除
      </el-button>

      <div class="spacer"></div>

      <!-- 条件筛选（前端过滤） -->
      <el-select v-model="query.park_area" class="w-190" placeholder="请选择园区位置" clearable filterable allow-create />
      <el-select v-model="query.analysis_mode" class="w-160" placeholder="请选择分析模式" clearable>
        <el-option label="全部" :value="undefined" />
        <el-option v-for="opt in ANALYSIS_MODE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-select v-model="query.camera_status" class="w-150" placeholder="请选择摄像头状态" clearable>
        <el-option label="全部" :value="undefined" />
        <el-option v-for="opt in CAMERA_STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-input v-model="query.camera_name" class="w-200" placeholder="摄像头名称" clearable />

      <el-button type="primary" plain @click="applyFilter(1)">查询</el-button>
      <el-button @click="resetQuery">重置</el-button>
    </div>

    <!-- 原始 JSON -->
    <el-card shadow="never" class="json-card" v-if="rawJsonText !== null">
      <template #header><div class="card-title">原始 JSON（{{ allItems.length }} 条）</div></template>
      <el-input type="textarea" :rows="6" :readonly="true" :autosize="{ minRows: 6, maxRows: 16 }" v-model="rawJsonText" />
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="pageItems"
        border
        stripe
        v-loading="loading"
        @selection-change="handleSelectionChange"
        :empty-text="allItemsLoaded ? '暂无数据（数据库为空）' : '加载中…'"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="camera_name" label="摄像头名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="park_area" label="所属园区位置" min-width="140" show-overflow-tooltip />
        <el-table-column prop="install_position" label="具体安装位置" min-width="160" show-overflow-tooltip />
        <el-table-column prop="rtsp_url" label="RTSP 地址" min-width="220" show-overflow-tooltip />
        <el-table-column label="分析模式" width="110">
          <template #default="{ row }">
            <el-tag type="info" disable-transitions>{{ ANALYSIS_MODE_MAP[row.analysis_mode] ?? '未知' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.camera_status)" disable-transitions>
              {{ CAMERA_STATUS_MAP[row.camera_status] ?? '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="录入时间" min-width="150" />
        <el-table-column prop="update_time" label="上次更新时间" min-width="150" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-divider direction="vertical" />
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            <el-divider direction="vertical" />
            <el-button
              size="small"
              :loading="testingMap[row.camera_id]"
              :disabled="testingMap[row.camera_id]"
              @click="handleTest(row)"
            >
              {{ testingMap[row.camera_id] ? '测试中…' : '测试连接' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pager">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :current-page="query.pageNum"
          :page-size="query.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredItems.length"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑 弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.mode === 'create' ? '新增摄像头' : '编辑摄像头'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" @submit.prevent>
        <el-form-item label="摄像头名称" prop="camera_name">
          <el-input v-model="form.camera_name" maxlength="64" placeholder="请输入摄像头名称" />
        </el-form-item>
        <el-form-item label="所属园区区域" prop="park_area">
          <el-select v-model="form.park_area" placeholder="请选择或输入" filterable allow-create class="w-100p">
            <el-option v-for="opt in parkAreaPreset" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="具体安装位置" prop="install_position">
          <el-input v-model="form.install_position" maxlength="64" placeholder="如：仓库 A1 门口 3 米高处" />
        </el-form-item>
        <el-form-item label="RTSP 地址" prop="rtsp_url">
          <el-input v-model="form.rtsp_url" placeholder="格式：rtsp://IP:端口/流地址" clearable />
        </el-form-item>
        <el-form-item label="分析模式" prop="analysis_mode">
          <el-select v-model="form.analysis_mode" placeholder="请选择分析模式" class="w-100p">
            <el-option v-for="opt in ANALYSIS_MODE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.loading" :disabled="dialog.loading" @click="handleSubmit">
          {{ dialog.mode === 'create' ? '提交' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import {
  getAllCameras,
  createCamera,
  updateCamera,
  deleteCameras,
  testCamera,
  ANALYSIS_MODE_MAP,
  CAMERA_STATUS_MAP,
  ANALYSIS_MODE_OPTIONS,
  CAMERA_STATUS_OPTIONS,
  RTSP_REGEX,
} from '@/api/camera'
import { ElMessage, ElMessageBox } from 'element-plus'

// ---------- 页面状态 ----------
const loading = ref(false)
const allItemsLoaded = ref(false)
const allItems = ref([])
const rawJsonText = ref(null)
const multipleSelection = ref([])

const query = reactive({
  pageNum: 1,
  pageSize: 20,
  park_area: undefined,
  analysis_mode: undefined,
  camera_status: undefined,
  camera_name: undefined,
})

const parkAreaPreset = ref([
  '西区仓库', '东区生产车间', '北区原料间', '南区危险品区', '园区入口', '园区出入口',
])

// ---------- 工具 ----------
const unwrap = (res) => res?.data ?? res ?? {}
const handleSelectionChange = (rows) => (multipleSelection.value = rows)
const statusTagType = (val) => (val === 2 ? 'success' : val === 1 ? 'warning' : 'info')

// ---------- 拉取“全部数据”
const fetchAll = async () => {
  loading.value = true
  allItemsLoaded.value = false
  try {
    const res = await getAllCameras(0, 100000)
    const data = unwrap(res)
    const items = Array.isArray(data) ? data : (data.items ?? data.data ?? [])
    allItems.value = items || []
    rawJsonText.value = JSON.stringify(allItems.value, null, 2)
  } catch (e) {
    rawJsonText.value = '[]'
    allItems.value = []
    // 展示更准确的错误文案
    const msg = e?.response?.data?.message || e?.message || '获取摄像头列表失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
    allItemsLoaded.value = true
  }
}

// ---------- 前端过滤 + 分页 ----------
const filteredItems = computed(() => {
  let arr = allItems.value.slice()
  if (query.park_area) arr = arr.filter((x) => String(x.park_area || '').trim() === String(query.park_area).trim())
  if (query.analysis_mode !== undefined) arr = arr.filter((x) => x.analysis_mode === query.analysis_mode)
  if (query.camera_status !== undefined) arr = arr.filter((x) => x.camera_status === query.camera_status)
  if (query.camera_name) {
    const kw = query.camera_name.trim().toLowerCase()
    arr = arr.filter((x) => String(x.camera_name || '').toLowerCase().includes(kw))
  }
  return arr
})
const pageItems = computed(() => {
  const start = (query.pageNum - 1) * query.pageSize
  return filteredItems.value.slice(start, start + query.pageSize)
})
const applyFilter = (toPage = 1) => { query.pageNum = toPage }
const resetQuery = () => {
  query.pageNum = 1; query.pageSize = 20
  query.park_area = undefined; query.analysis_mode = undefined; query.camera_status = undefined; query.camera_name = undefined
  applyFilter(1)
}
const handleSizeChange = (size) => { query.pageSize = size; applyFilter(1) }
const handlePageChange = (page) => { query.pageNum = page }

// ---------- 测试连接 ----------
const testingMap = reactive({})
const handleTest = async (row) => {
  testingMap[row.camera_id] = true
  try {
    const res = await testCamera(row.camera_id)
    const data = unwrap(res)
    const msg = data.message || data.msg || '测试完成'
    ElMessage[/(成功|success)/i.test(msg) ? 'success' : 'error'](msg)
  } catch (e) {
    const msg = e?.response?.data?.message || '测试失败：网络或服务器异常'
    ElMessage.error(msg)
  } finally {
    setTimeout(() => (testingMap[row.camera_id] = false), 600)
  }
}

// ---------- 新增/编辑 ----------
const dialog = reactive({ visible: false, mode: 'create', loading: false })
const formRef = ref()
const form = reactive({
  camera_id: undefined,
  camera_name: '',
  park_area: '',
  install_position: '',
  rtsp_url: '',
  analysis_mode: 0,
})

const rules = {
  camera_name: [{ required: true, message: '请输入摄像头名称', trigger: 'blur' }],
  park_area: [{ required: true, message: '请选择所属园区区域', trigger: 'change' }],
  install_position: [{ required: true, message: '请输入具体安装位置', trigger: 'blur' }],
  rtsp_url: [
    { required: true, message: '请输入 RTSP 地址', trigger: 'blur' },
    {
      validator: (_r, v, cb) => (v && RTSP_REGEX.test(v) ? cb() : cb(new Error('请输入正确的 RTSP 地址'))),
      trigger: ['blur', 'change'],
    },
  ],
  analysis_mode: [{ required: true, message: '请选择分析模式', trigger: 'change' }],
}

const openCreateDialog = () => {
  dialog.mode = 'create'
  dialog.visible = true
  nextTick(() => formRef.value?.resetFields())
}
const openEditDialog = (row) => {
  dialog.mode = 'edit'
  dialog.visible = true
  nextTick(() => {
    formRef.value?.clearValidate()
    Object.assign(form, {
      camera_id: row.camera_id,
      camera_name: row.camera_name,
      park_area: row.park_area,
      install_position: row.install_position,
      rtsp_url: row.rtsp_url,
      analysis_mode: row.analysis_mode,
    })
  })
}

const handleSubmit = async () => {
  await formRef.value.validate().catch(() => Promise.reject('invalid'))
  dialog.loading = true
  try {
    const payload = {
      camera_name: form.camera_name,
      park_area: form.park_area,
      install_position: form.install_position,
      rtsp_url: form.rtsp_url,
      analysis_mode: Number(form.analysis_mode), // 显式转为数字，避免后端校验失败
    }
    if (dialog.mode === 'create') {
      await createCamera(payload)
      ElMessage.success('创建成功')
    } else {
      await updateCamera(form.camera_id, payload) // 注意：带尾斜杠的 URL
      ElMessage.success('保存成功')
    }
    dialog.visible = false
    setTimeout(async () => { await fetchAll(); applyFilter(1) }, 600)
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.detail ||
      e?.message ||
      '提交失败，请稍后重试'
    ElMessage.error(msg)
  } finally {
    dialog.loading = false
  }
}

// ---------- 删除 ----------
const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确认删除“${row.camera_name}”吗？`, '提示', { type: 'warning' })
  await deleteCameras(String(row.camera_id))
  ElMessage.success('删除成功')
  await fetchAll(); applyFilter()
}
const handleBatchDelete = async () => {
  if (!multipleSelection.value.length) return
  await ElMessageBox.confirm(`确认批量删除选中的 ${multipleSelection.value.length} 条记录吗？`, '提示', { type: 'warning' })
  const ids = multipleSelection.value.map((r) => r.camera_id)
  await deleteCameras(ids)
  ElMessage.success('批量删除成功')
  await fetchAll(); applyFilter(1)
}

onMounted(async () => {
  await fetchAll()
  applyFilter(1)
})
</script>

<style scoped>
.page-wrap { padding: 12px 16px 20px; }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.spacer { flex: 1; }
.w-150 { width: 150px; } .w-160 { width: 160px; } .w-190 { width: 190px; } .w-200 { width: 200px; } .w-100p { width: 100%; }
.json-card { margin-bottom: 12px; } .card-title { font-weight: 600; }
.table-card { --el-card-padding: 8px 8px 12px 8px; }
.pager { display: flex; justify-content: flex-end; padding: 10px 6px 2px; }
</style>
