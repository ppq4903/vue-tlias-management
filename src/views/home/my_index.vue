<template>
  <div class="home">
    <!-- 顶部未处理告警提示 -->
    <el-card class="alarm-bar" shadow="never" :body-style="{padding:'12px 16px'}">
      <div class="alarm-bar__head">
        <div class="left">
          <span class="badge">未处理告警（{{ pendingTotal }} 条）</span>
        </div>
        <el-button type="primary" link @click="$router.push('/alarm')">查看全部</el-button>
      </div>

      <div class="alarm-list">
        <template v-for="(a,idx) in alarms" :key="a.alarm_id || idx">
          <div class="alarm-item">
            <el-tag :type="tagType(a.alarm_status)" size="small" effect="dark" round>
              {{ tagText(a.alarm_status) }}
            </el-tag>
            <span>【{{ a.alarm_type || '未知类型' }}】</span>
            <span class="meta">摄像头：{{ a.camera_name || a.camera_id }}</span>
            <span class="meta">区域：{{ a.park_area || '-' }}</span>
            <span class="meta">时间：{{ a.alarm_time || '-' }}</span>
          </div>
        </template>
      </div>
    </el-card>

    <!-- 两列图表 -->
    <div class="grid">
      <el-card class="grid-item" shadow="never">
        <div class="card-head"><el-icon><PieChart /></el-icon> 今日告警类型分布</div>
        <div ref="pieRef" class="chart"></div>
      </el-card>

      <el-card class="grid-item" shadow="never">
        <div class="card-head"><el-icon><Histogram /></el-icon> 区域告警 TOP3</div>
        <div ref="barRef" class="chart"></div>
      </el-card>
    </div>

    <!-- 数字卡片 -->
    <div class="grid">
      <el-card class="grid-item number-card" shadow="never">
        <div class="card-head"><el-icon><Checked /></el-icon> 今日处理率</div>
        <div class="number">
          <b>{{ (rate.rate * 100).toFixed(1) }}%</b>
          （已处理 {{ rate.done }} / 总数 {{ rate.total }} ，未处理 {{ rate.pending }}）
        </div>
      </el-card>

      <el-card class="grid-item number-card" shadow="never">
        <div class="card-head"><el-icon><VideoCamera /></el-icon> 摄像头状态</div>
        <div class="number">
          在线 <b>{{ cam.online }}</b> / 离线 <b>{{ cam.offline }}</b> / 总数 <b>{{ cam.total }}</b>
        </div>
        <el-button size="small" @click="openOffline">查看离线列表</el-button>
      </el-card>
    </div>

    <!-- 快捷入口 -->
    <el-card shadow="never">
      <div class="card-head"><el-icon><Cpu /></el-icon> 快捷入口</div>
      <div class="quick-entry">
        <el-button @click="$router.push('/alarm')"><el-icon><Bell /></el-icon>告警列表</el-button>
        <el-button @click="$router.push('/sys')"><el-icon><VideoCamera /></el-icon>摄像头</el-button>
        <el-button @click="openExport"><el-icon><Download /></el-icon>导出报表</el-button>
      </div>
    </el-card>

    <!-- 导出对话框 -->
    <el-dialog v-model="exportVisible" title="导出告警报表" width="420px">
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
      <template #footer>
        <el-button @click="exportVisible=false">取消</el-button>
        <el-button type="primary" @click="onExport">导出</el-button>
      </template>
    </el-dialog>

    <!-- 离线摄像头列表 -->
    <el-dialog v-model="offlineVisible" title="离线摄像头" width="680px">
      <el-table :data="offline" border stripe size="small">
        <el-table-column prop="camera_id" label="ID" width="120" />
        <el-table-column prop="camera_name" label="名称" />
        <el-table-column prop="park_area" label="区域" width="160" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import * as echarts from 'echarts'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, Cpu, Download, Histogram, PieChart, Checked, VideoCamera } from '@element-plus/icons-vue'
import {
  apiGetPendingAlarms, apiGetAlarms, apiGetCameraInfos,
  apiGetOfflineCameras, apiExportReport
} from '@/api/home'

// --- router 实例（用于“摄像头”快捷入口）
const router = useRouter()

// --- state
const alarms = ref([])
const pendingTotal = ref(0)
const rate = ref({ rate: 0, total: 0, done: 0, pending: 0 })
const cam = ref({ online: 0, total: 0, offline: 0 })

const pieRef = ref(null)
const barRef = ref(null)
let pieChart = null
let barChart = null

const exportVisible = ref(false)
const range = ref([])
const offlineVisible = ref(false)
const offline = ref([])

// --- helpers
function tagType (s) {
  if (s === 0) return 'danger'
  if (s === 1) return 'success'
  if (s === 2) return 'info'
  return 'warning'
}
function tagText (s) {
  if (s === 0) return '未处理'
  if (s === 1) return '已处理'
  if (s === 2) return '已忽略'
  return '未知'
}
function isToday (ts) {
  if (!ts) return false
  const d = String(ts)
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return d.slice(0, 10) === today
}

// 智能跳转到“摄像头”页
function goCamera () {
  const candidates = ['/system/camera', '/camera', '/cameraManage', '/cameras']
  const target = candidates.find(p => {
    const r = router.resolve(p)
    return r && r.matched && r.matched.length > 0
  })
  if (target) router.push(target)
  else ElMessage.warning('未找到“摄像头”路由，请在 my_index.vue 的 candidates 中调整目标路径')
}

async function loadData () {
  // 只调用“文档里存在”的两个接口：alarms + cameraInfos
  const [p1, pAllAlarms, pCams] = await Promise.all([
    apiGetPendingAlarms(3),
    apiGetAlarms({ limit: 500, skip: 0 }),
    apiGetCameraInfos({ limit: 500, skip: 0 })
  ])

  // 1) 顶部未处理展示
  const pendingRows = p1.data?.rows || p1.data || []
  pendingTotal.value = p1.data?.total ?? pendingRows.length
  alarms.value = pendingRows

  // 2) 今日告警统计 + 区域 TOP3 + 今日处理率（前端就地统计）
  const allRows = pAllAlarms.data?.rows || pAllAlarms.data || []
  const todayRows = allRows.filter(r => isToday(r.alarm_time))

  const typeMap = new Map()
  const areaMap = new Map()
  let done = 0, pending = 0
  for (const r of todayRows) {
    // pie: 按 alarm_type 聚合
    const t = r.alarm_type || '未知类型'
    typeMap.set(t, (typeMap.get(t) || 0) + 1)

    // bar: 按 park_area 聚合
    const a = r.park_area || '未分区'
    areaMap.set(a, (areaMap.get(a) || 0) + 1)

    // 处理率
    if (r.alarm_status === 0) pending++
    else done++
  }
  const pieData = [...typeMap.entries()].map(([label, value]) => ({ label, value }))
  const barDataAll = [...areaMap.entries()].map(([area, count]) => ({ area, count }))
  barDataAll.sort((a, b) => b.count - a.count)
  const barData = barDataAll.slice(0, 3)

  rate.value = {
    total: todayRows.length,
    done,
    pending,
    rate: todayRows.length ? done / todayRows.length : 0
  }

  // 3) 摄像头在线/离线数（前端就地统计）
  const camRows = pCams.data?.rows || pCams.data || []
  let online = 0, offlineCnt = 0
  for (const c of camRows) {
    // 约定：camera_status=0 表示离线；非 0 记为在线
    if (Number(c.camera_status) === 0) offlineCnt++
    else online++
  }
  cam.value = { online, offline: offlineCnt, total: online + offlineCnt }

  // 4) 画图
  initCharts(pieData, barData)
}

function initCharts (pieData, barData) {
  // ====== PIE（渐变圆环 + 标签/阴影/滚动 legend） ====== //
  pieChart = echarts.init(pieRef.value)
  pieChart.setOption({
    animationDuration: 800,
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value, percent }) => `
        <div style="min-width:140px">
          <div><b>${name}</b></div>
          <div>数量：${value}</div>
          <div>占比：${percent}%</div>
        </div>`
    },
    legend: {
      top: 10,
      type: 'scroll',
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#606266' }
    },
    series: [{
      name: '类型分布',
      type: 'pie',
      radius: ['50%', '72%'],
      center: ['50%', '58%'],
      avoidLabelOverlap: false,
      stillShowZeroSum: false,
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 2,
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowBlur: 6
      },
      label: {
        show: true,
        formatter: '{b|{b}}\n{c} 次（{d}%）',
        rich: { b: { fontWeight: 600, lineHeight: 18 } }
      },
      emphasis: { scale: true, scaleSize: 6 },
      data: pieData.map(d => ({ name: d.label, value: d.value }))
    }]
  })

  // ====== BAR（圆角柱 + 渐变 + 顶部数值） ====== //
  barChart = echarts.init(barRef.value)
  barChart.setOption({
    animationDuration: 800,
    grid: { left: 60, right: 20, top: 26, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: barData.map(d => d.area),
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisTick: { show: false },
      axisLabel: { color: '#606266' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#ebeef5' } },
      axisLabel: { color: '#606266' }
    },
    series: [{
      type: 'bar',
      data: barData.map(d => d.count),
      barWidth: 26,
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.95)' },
          { offset: 1, color: 'rgba(64,158,255,0.35)' }
        ])
      },
      label: { show: true, position: 'top', fontWeight: 600 }
    }]
  })

  // 自适应
  window.addEventListener('resize', onResize, { passive: true })
}
function onResize () {
  pieChart && pieChart.resize()
  barChart && barChart.resize()
}

// 导出
function openExport () {
  exportVisible.value = true
}
async function onExport () {
  if (!range.value || range.value.length !== 2) return ElMessage.warning('请选择时间范围')
  const [start, end] = range.value
  try {
    const { data } = await apiExportReport(start, end)
    const blob = new Blob([data], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alarm_report_${start}_${end}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    exportVisible.value = false
    ElMessage.success('报表开始下载')
  } catch (e) {
    ElMessage.error('导出接口不可用或未实现，请联系后端开启 /alarms/export')
  }
}

// 离线摄像头
async function openOffline () {
  offlineVisible.value = true
  const { data } = await apiGetOfflineCameras()
  offline.value = data?.rows || data || []
}

onMounted(loadData)
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<style scoped>
.home{display:flex;flex-direction:column;gap:16px}

/* 顶部红条 */
.alarm-bar{background:linear-gradient(90deg,#ffeded,#fff);border:1px solid #ffbfbf}
.alarm-bar__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.badge{color:#d30;font-weight:600}
.alarm-list .alarm-item{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:4px 0}
.meta{color:#606266}

/* 布局与卡片 */
.grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:280px;gap:16px}
.grid-item{height:100%}
.card-head{display:flex;align-items:center;gap:8px;font-weight:600}
.chart{height:240px}

/* 数字卡片 */
.number-card .number{font-size:16px}
.number-card b{font-size:22px;margin:0 4px}

/* 快捷入口 */
.quick-entry{display:flex;gap:16px}
</style>
