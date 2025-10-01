<!-- 该文件是主布局组件，所有页面（除登录页面）都嵌套在该组件内
 -->
<script setup>
import {ref,onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'// 引入ElMessage和ElMessageBox
const router=useRouter();
const name=ref('')
const setNameDisplay=()=>{
  const loginInfo=JSON.parse(localStorage.getItem("loginInfo"));
  if(loginInfo && loginInfo.name){
    name.value=loginInfo.name;
  }
}
onMounted(()=>{
  setNameDisplay();
}
)
const handleLogout=()=>{
  console.log("用户点击了退出登录按钮");
   ElMessageBox.confirm("确定退出登录", '通知', 
  {confirmButtonText: '确定',cancelButtonText: '取消',type: 'info',}//type指定消息内容前的图标
  )
  .then(async() => {// 点击了确认按钮
    localStorage.removeItem("loginInfo");
    ElMessage.success("退出成功");
    router.push("/login");
    })
  .catch(() => {// 点击了取消按钮
    ElMessage.info('已取消');
  })
}

const handleChangePwd=()=>{

}
</script>

<template>
  <div class="common-layout">
    <el-container>
      <!-- Header 区域 -->
      <el-header class="header">
          <el-menu router default-active="[]" mode="horizontal" >
            <span class="title">园区智能安防</span>
            <el-menu-item index="index">
              <el-icon><house /></el-icon>首页
            </el-menu-item>
            <el-menu-item index="monitor">
              <el-icon><video-camera /></el-icon>实时监控
            </el-menu-item>
            <el-menu-item index="alarm">
              <el-icon><warn-triangle-filled /></el-icon>告警管理
            </el-menu-item>
            <el-menu-item index="emp">
              <el-icon><user /></el-icon>员工管理
            </el-menu-item>
            <el-menu-item index="sys">
              <el-icon><setting /></el-icon>系统配置（摄像头管理）
            </el-menu-item>
            <!-- <span class="right_tool" style="margin-left: 300px;">
              <a href="" @click="handleChangePwd">
                <el-icon><EditPen /></el-icon> 修改密码 &nbsp;&nbsp;&nbsp; |  &nbsp;&nbsp;&nbsp;
              </a>
              <a href="javascript:;" @click="handleLogout">
                <el-icon><SwitchButton /></el-icon> 退出登录 【{{ name }}】
              </a>
            </span> -->
          </el-menu>
      </el-header>
      <!-- 余下区域 -->
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.title {
  width: 260px;
  background-color: aqua;
  color: #79bce0;
  font-size: 21px;
  font-family: 黑体;
  line-height: 60px;
  font-weight: bolder;
}

.right_tool{
  float: right;
  line-height: 60px;
}

a {
  color: black;
  text-decoration: none;
}


</style>
