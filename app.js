// ==================== 数据管理类 ====================
class DataManager {
    constructor() {
        this.members = this.loadData('members') || [];
        this.activities = this.loadData('activities') || [];
        this.schedules = this.loadData('schedules') || [];
        this.settings = this.loadData('settings') || {
            algorithm: 'rotation',
            notificationEnabled: true,
            notificationDays: 3
        };
    }

    loadData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // 成员管理
    addMember(member) {
        member.id = Date.now().toString();
        member.participationCount = 0;
        member.status = 'active';
        this.members.push(member);
        this.saveData('members', this.members);
        return member;
    }

    updateMember(id, updates) {
        const index = this.members.findIndex(m => m.id === id);
        if (index !== -1) {
            this.members[index] = { ...this.members[index], ...updates };
            this.saveData('members', this.members);
            return this.members[index];
        }
        return null;
    }

    deleteMember(id) {
        this.members = this.members.filter(m => m.id !== id);
        this.saveData('members', this.members);
    }

    getActiveMembers() {
        return this.members.filter(m => m.status === 'active');
    }

    // 活动管理
    addActivity(activity) {
        activity.id = Date.now().toString();
        this.activities.push(activity);
        this.saveData('activities', this.activities);
        return activity;
    }

    updateActivity(id, updates) {
        const index = this.activities.findIndex(a => a.id === id);
        if (index !== -1) {
            this.activities[index] = { ...this.activities[index], ...updates };
            this.saveData('activities', this.activities);
            return this.activities[index];
        }
        return null;
    }

    deleteActivity(id) {
        this.activities = this.activities.filter(a => a.id !== id);
        this.saveData('activities', this.activities);
    }

    // 排班管理
    addSchedule(schedule) {
        schedule.id = Date.now().toString() + Math.random();
        this.schedules.push(schedule);
        this.saveData('schedules', this.schedules);
        return schedule;
    }

    clearSchedules() {
        this.schedules = [];
        this.saveData('schedules', this.schedules);
    }

    getSchedulesByDateRange(startDate, endDate) {
        return this.schedules.filter(s => {
            const scheduleDate = new Date(s.date);
            return scheduleDate >= startDate && scheduleDate <= endDate;
        });
    }

    getUpcomingSchedules(limit = 10) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return this.schedules
            .filter(s => new Date(s.date) >= now)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, limit);
    }

    // 设置管理
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.saveData('settings', this.settings);
    }

    // 导出数据
    exportData() {
        return {
            members: this.members,
            activities: this.activities,
            schedules: this.schedules,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
    }

    // 导入数据
    importData(data) {
        if (data.members) {
            this.members = data.members;
            this.saveData('members', this.members);
        }
        if (data.activities) {
            this.activities = data.activities;
            this.saveData('activities', this.activities);
        }
        if (data.schedules) {
            this.schedules = data.schedules;
            this.saveData('schedules', this.schedules);
        }
        if (data.settings) {
            this.settings = data.settings;
            this.saveData('settings', this.settings);
        }
    }

    // 清除所有数据
    clearAllData() {
        localStorage.clear();
        this.members = [];
        this.activities = [];
        this.schedules = [];
        this.settings = {
            algorithm: 'rotation',
            notificationEnabled: true,
            notificationDays: 3
        };
    }
}

// ==================== 排班算法类 ====================
class ScheduleGenerator {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    generate(startDate, endDate) {
        const activities = this.dataManager.activities;
        const members = this.dataManager.getActiveMembers();
        const algorithm = this.dataManager.settings.algorithm;

        if (members.length === 0) {
            throw new Error('没有活跃的成员，无法生成排班');
        }

        if (activities.length === 0) {
            throw new Error('没有活动，无法生成排班');
        }

        // 清除旧的排班
        this.dataManager.clearSchedules();

        // 重置参与次数
        members.forEach(member => {
            member.participationCount = 0;
        });

        const schedules = [];

        activities.forEach(activity => {
            const activitySchedules = this.generateActivitySchedules(
                activity,
                members,
                startDate,
                endDate,
                algorithm
            );
            schedules.push(...activitySchedules);
        });

        // 保存所有排班
        schedules.forEach(schedule => {
            this.dataManager.addSchedule(schedule);
        });

        // 更新成员参与次数
        this.dataManager.saveData('members', this.dataManager.members);

        return schedules;
    }

    generateActivitySchedules(activity, members, startDate, endDate, algorithm) {
        const schedules = [];
        const frequency = parseInt(activity.frequency);
        const frequencyUnit = activity.frequencyUnit;

        let currentDate = new Date(startDate);
        let memberIndex = 0;
        const sortedMembers = [...members].sort((a, b) =>
            a.participationCount - b.participationCount
        );

        while (currentDate <= endDate) {
            let assignedMember;

            switch (algorithm) {
                case 'rotation':
                    assignedMember = sortedMembers[memberIndex % sortedMembers.length];
                    memberIndex++;
                    break;

                case 'random':
                    assignedMember = sortedMembers[Math.floor(Math.random() * sortedMembers.length)];
                    break;

                case 'balanced':
                    // 选择参与次数最少的成员
                    sortedMembers.sort((a, b) => a.participationCount - b.participationCount);
                    assignedMember = sortedMembers[0];
                    break;

                default:
                    assignedMember = sortedMembers[0];
            }

            schedules.push({
                activityId: activity.id,
                activityName: activity.name,
                memberId: assignedMember.id,
                memberName: assignedMember.name,
                date: currentDate.toISOString().split('T')[0],
                notified: false
            });

            // 更新成员参与次数
            assignedMember.participationCount++;

            // 计算下一个日期
            if (frequencyUnit === 'days') {
                currentDate.setDate(currentDate.getDate() + frequency);
            } else if (frequencyUnit === 'weeks') {
                currentDate.setDate(currentDate.getDate() + (frequency * 7));
            } else if (frequencyUnit === 'months') {
                currentDate.setMonth(currentDate.getMonth() + frequency);
            }
        }

        return schedules;
    }
}

// ==================== 通知管理类 ====================
class NotificationManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.checkInterval = null;
    }

    start() {
        // 每天检查一次
        this.checkInterval = setInterval(() => {
            this.checkUpcomingSchedules();
        }, 24 * 60 * 60 * 1000);

        // 启动时立即检查一次
        this.checkUpcomingSchedules();
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkUpcomingSchedules() {
        if (!this.dataManager.settings.notificationEnabled) {
            return;
        }

        const notificationDays = this.dataManager.settings.notificationDays;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + notificationDays);

        const schedules = this.dataManager.schedules.filter(s => {
            const scheduleDate = new Date(s.date);
            scheduleDate.setHours(0, 0, 0, 0);
            return scheduleDate.getTime() === targetDate.getTime() && !s.notified;
        });

        schedules.forEach(schedule => {
            this.sendNotification(schedule);
            schedule.notified = true;
        });

        if (schedules.length > 0) {
            this.dataManager.saveData('schedules', this.dataManager.schedules);
        }
    }

    sendNotification(schedule) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('排班提醒', {
                body: `${schedule.memberName}，您将在${schedule.date}负责${schedule.activityName}`,
                icon: '📅'
            });
        } else {
            console.log(`通知: ${schedule.memberName}将在${schedule.date}负责${schedule.activityName}`);
        }
    }

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// ==================== UI管理类 ====================
class UIManager {
    constructor(dataManager, scheduleGenerator, notificationManager) {
        this.dataManager = dataManager;
        this.scheduleGenerator = scheduleGenerator;
        this.notificationManager = notificationManager;
        this.filterStartDate = null;
        this.filterEndDate = null;
        this.initializeEventListeners();
        this.renderAll();
    }

    initializeEventListeners() {
        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // 排班表格筛选
        document.getElementById('filterScheduleBtn').addEventListener('click', () => {
            const filterDiv = document.getElementById('scheduleFilter');
            filterDiv.style.display = filterDiv.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('applyFilterBtn').addEventListener('click', () => {
            this.filterStartDate = document.getElementById('filterStartDate').value;
            this.filterEndDate = document.getElementById('filterEndDate').value;
            this.renderScheduleTable();
        });

        document.getElementById('clearFilterBtn').addEventListener('click', () => {
            this.filterStartDate = null;
            this.filterEndDate = null;
            document.getElementById('filterStartDate').value = '';
            document.getElementById('filterEndDate').value = '';
            this.renderScheduleTable();
        });

        document.getElementById('generateScheduleBtn').addEventListener('click', () => this.showGenerateScheduleModal());

        // 成员管理
        document.getElementById('addMemberBtn').addEventListener('click', () => this.showAddMemberModal());

        // 活动管理
        document.getElementById('addActivityBtn').addEventListener('click', () => this.showAddActivityModal());

        // 设置
        document.getElementById('algorithmSelect').addEventListener('change', (e) => {
            this.dataManager.updateSettings({ algorithm: e.target.value });
        });
        document.getElementById('notificationEnabled').addEventListener('change', (e) => {
            this.dataManager.updateSettings({ notificationEnabled: e.target.checked });
            if (e.target.checked) {
                this.notificationManager.requestPermission();
            }
        });
        document.getElementById('notificationDays').addEventListener('change', (e) => {
            this.dataManager.updateSettings({ notificationDays: parseInt(e.target.value) });
        });
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importDataFile').click();
        });
        document.getElementById('importDataFile').addEventListener('change', (e) => this.importData(e));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());

        // 弹窗关闭
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal')) {
                this.closeModal();
            }
        });
    }

    renderAll() {
        this.renderScheduleTable();
        this.renderMembers();
        this.renderActivities();
        this.renderSettings();
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }

    // ==================== 排班表格 ====================
    renderScheduleTable() {
        const container = document.getElementById('scheduleTableContainer');
        const schedules = this.dataManager.schedules;

        if (schedules.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="background: var(--card-bg); border-radius: 12px; padding: 60px 20px; box-shadow: var(--shadow);">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">暂无排班数据</div>
                    <div class="empty-state-subtext">点击上方"生成排班"按钮创建排班计划</div>
                </div>
            `;
            return;
        }

        // 按活动分组
        const schedulesByActivity = {};
        schedules.forEach(schedule => {
            const key = schedule.activityId;
            if (!schedulesByActivity[key]) {
                schedulesByActivity[key] = {
                    activity: {
                        id: schedule.activityId,
                        name: schedule.activityName
                    },
                    schedules: []
                };
            }
            schedulesByActivity[key].schedules.push(schedule);
        });

        // 应用日期筛选
        Object.keys(schedulesByActivity).forEach(key => {
            let filteredSchedules = schedulesByActivity[key].schedules;

            if (this.filterStartDate) {
                filteredSchedules = filteredSchedules.filter(s => s.date >= this.filterStartDate);
            }
            if (this.filterEndDate) {
                filteredSchedules = filteredSchedules.filter(s => s.date <= this.filterEndDate);
            }

            schedulesByActivity[key].schedules = filteredSchedules.sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );
        });

        // 渲染表格
        let html = '';
        Object.values(schedulesByActivity).forEach(group => {
            if (group.schedules.length === 0) return;

            html += `
                <div class="schedule-group">
                    <div class="schedule-group-header">
                        <div>
                            <div class="schedule-group-title">${group.activity.name}</div>
                            <div class="schedule-group-info">共 ${group.schedules.length} 次活动</div>
                        </div>
                    </div>
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th style="width: 30%">日期</th>
                                <th style="width: 15%">星期</th>
                                <th style="width: 30%">负责人</th>
                                <th style="width: 25%">活动名称</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.schedules.map(schedule => {
                                const date = new Date(schedule.date);
                                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                                const weekday = weekdays[date.getDay()];
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                return `
                                    <tr>
                                        <td class="schedule-date">${schedule.date}</td>
                                        <td>
                                            <span class="schedule-weekday ${isWeekend ? 'weekend' : ''}">
                                                星期${weekday}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="schedule-member">${schedule.memberName}</span>
                                        </td>
                                        <td>${schedule.activityName}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        container.innerHTML = html || `
            <div class="empty-state" style="background: var(--card-bg); border-radius: 12px; padding: 60px 20px; box-shadow: var(--shadow);">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">没有符合条件的排班数据</div>
                <div class="empty-state-subtext">尝试调整筛选条件</div>
            </div>
        `;
    }

    // ==================== 排班生成 ====================
    showGenerateScheduleModal() {
        const today = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <h2>生成排班计划</h2>
            <form id="generateScheduleForm">
                <div class="form-group">
                    <label>开始日期</label>
                    <input type="date" id="startDate" value="${today.toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>结束日期</label>
                    <input type="date" id="endDate" value="${threeMonthsLater.toISOString().split('T')[0]}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">生成</button>
                </div>
            </form>
        `;

        document.getElementById('generateScheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateSchedule();
        });

        this.openModal();
    }

    generateSchedule() {
        try {
            const startDate = new Date(document.getElementById('startDate').value);
            const endDate = new Date(document.getElementById('endDate').value);

            if (startDate > endDate) {
                alert('开始日期不能晚于结束日期');
                return;
            }

            this.scheduleGenerator.generate(startDate, endDate);
            this.closeModal();
            this.renderAll();
            alert('排班计划生成成功！');
        } catch (error) {
            alert(error.message);
        }
    }

    // ==================== 成员管理 ====================
    renderMembers() {
        const tbody = document.querySelector('#membersTable tbody');
        const members = this.dataManager.members;

        document.getElementById('totalMembers').textContent = members.length;
        document.getElementById('activeMembers').textContent =
            members.filter(m => m.status === 'active').length;

        if (members.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">👥</div>
                            <div class="empty-state-text">暂无成员</div>
                            <div class="empty-state-subtext">点击上方"添加成员"按钮添加团队成员</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = members.map(member => `
            <tr>
                <td>${member.name}</td>
                <td>${member.email || '-'}</td>
                <td>
                    <span class="status-badge status-${member.status}">
                        ${member.status === 'active' ? '活跃' : '暂停'}
                    </span>
                </td>
                <td>${member.participationCount || 0}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="uiManager.editMember('${member.id}')">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="uiManager.deleteMember('${member.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    }

    showAddMemberModal() {
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <h2>添加成员</h2>
            <div class="tabs" style="margin-bottom: 20px;">
                <button type="button" class="tab-btn active" onclick="uiManager.switchAddMemberTab('single')">单个添加</button>
                <button type="button" class="tab-btn" onclick="uiManager.switchAddMemberTab('batch')">批量导入</button>
            </div>

            <div id="singleAddTab">
                <form id="addMemberForm">
                    <div class="form-group">
                        <label>姓名 *</label>
                        <input type="text" id="memberName" required>
                    </div>
                    <div class="form-group">
                        <label>邮箱</label>
                        <input type="email" id="memberEmail">
                    </div>
                    <div class="form-group">
                        <label>状态</label>
                        <select id="memberStatus">
                            <option value="active">活跃</option>
                            <option value="inactive">暂停</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                        <button type="submit" class="btn btn-primary">添加</button>
                    </div>
                </form>
            </div>

            <div id="batchAddTab" style="display: none;">
                <form id="batchAddMemberForm">
                    <div class="form-group">
                        <label>批量添加成员</label>
                        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 10px;">
                            每行一个成员，格式：姓名 或 姓名,邮箱<br>
                            例如：<br>
                            张三<br>
                            李四,lisi@example.com<br>
                            王五,wangwu@example.com
                        </p>
                        <textarea id="batchMemberInput" rows="10" placeholder="张三&#10;李四,lisi@example.com&#10;王五,wangwu@example.com" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>默认状态</label>
                        <select id="batchMemberStatus">
                            <option value="active">活跃</option>
                            <option value="inactive">暂停</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                        <button type="submit" class="btn btn-primary">批量添加</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('addMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addMember();
        });

        document.getElementById('batchAddMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.batchAddMembers();
        });

        this.openModal();
    }

    switchAddMemberTab(tab) {
        const singleTab = document.getElementById('singleAddTab');
        const batchTab = document.getElementById('batchAddTab');
        const buttons = document.querySelectorAll('#modalBody .tab-btn');

        if (tab === 'single') {
            singleTab.style.display = 'block';
            batchTab.style.display = 'none';
            buttons[0].classList.add('active');
            buttons[1].classList.remove('active');
        } else {
            singleTab.style.display = 'none';
            batchTab.style.display = 'block';
            buttons[0].classList.remove('active');
            buttons[1].classList.add('active');
        }
    }

    batchAddMembers() {
        const input = document.getElementById('batchMemberInput').value;
        const defaultStatus = document.getElementById('batchMemberStatus').value;

        if (!input.trim()) {
            alert('请输入成员信息');
            return;
        }

        const lines = input.trim().split('\n').filter(line => line.trim());
        const members = [];
        const errors = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            const parts = trimmedLine.split(',').map(p => p.trim());
            const name = parts[0];
            const email = parts[1] || '';

            if (!name) {
                errors.push(`第${index + 1}行：姓名不能为空`);
                return;
            }

            members.push({
                name: name,
                email: email,
                status: defaultStatus
            });
        });

        if (errors.length > 0) {
            alert('导入出错：\n' + errors.join('\n'));
            return;
        }

        if (members.length === 0) {
            alert('没有有效的成员数据');
            return;
        }

        // 添加所有成员
        members.forEach(member => {
            this.dataManager.addMember(member);
        });

        this.closeModal();
        this.renderMembers();
        alert(`成功添加 ${members.length} 个成员！`);
    }

    addMember() {
        const member = {
            name: document.getElementById('memberName').value,
            email: document.getElementById('memberEmail').value,
            status: document.getElementById('memberStatus').value
        };

        this.dataManager.addMember(member);
        this.closeModal();
        this.renderMembers();
    }

    editMember(id) {
        const member = this.dataManager.members.find(m => m.id === id);
        if (!member) return;

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <h2>编辑成员</h2>
            <form id="editMemberForm">
                <div class="form-group">
                    <label>姓名 *</label>
                    <input type="text" id="memberName" value="${member.name}" required>
                </div>
                <div class="form-group">
                    <label>邮箱</label>
                    <input type="email" id="memberEmail" value="${member.email || ''}">
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="memberStatus">
                        <option value="active" ${member.status === 'active' ? 'selected' : ''}>活跃</option>
                        <option value="inactive" ${member.status === 'inactive' ? 'selected' : ''}>暂停</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        document.getElementById('editMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateMember(id);
        });

        this.openModal();
    }

    updateMember(id) {
        const updates = {
            name: document.getElementById('memberName').value,
            email: document.getElementById('memberEmail').value,
            status: document.getElementById('memberStatus').value
        };

        this.dataManager.updateMember(id, updates);
        this.closeModal();
        this.renderMembers();
    }

    deleteMember(id) {
        if (confirm('确定要删除这个成员吗？')) {
            this.dataManager.deleteMember(id);
            this.renderMembers();
        }
    }

    // ==================== 活动管理 ====================
    renderActivities() {
        const grid = document.getElementById('activityGrid');
        const activities = this.dataManager.activities;

        if (activities.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon">🎯</div>
                    <div class="empty-state-text">暂无活动</div>
                    <div class="empty-state-subtext">点击上方"添加活动"按钮创建团队活动</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = activities.map(activity => `
            <div class="activity-card">
                <h3>${activity.name}</h3>
                <div class="activity-card-info">
                    📝 ${activity.description || '暂无描述'}
                </div>
                <div class="activity-card-info">
                    🔄 每${activity.frequency}${this.getFrequencyUnitText(activity.frequencyUnit)}
                </div>
                <div class="activity-card-actions">
                    <button class="btn btn-sm btn-secondary" onclick="uiManager.editActivity('${activity.id}')">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="uiManager.deleteActivity('${activity.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    getFrequencyUnitText(unit) {
        const units = {
            'days': '天',
            'weeks': '周',
            'months': '月'
        };
        return units[unit] || unit;
    }

    showAddActivityModal() {
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <h2>添加活动</h2>
            <form id="addActivityForm">
                <div class="form-group">
                    <label>活动名称 *</label>
                    <input type="text" id="activityName" placeholder="例如：技术分享会" required>
                </div>
                <div class="form-group">
                    <label>活动描述</label>
                    <textarea id="activityDescription" rows="3" placeholder="简要描述活动内容"></textarea>
                </div>
                <div class="form-group">
                    <label>活动频率 *</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="activityFrequency" value="1" min="1" required style="flex: 1;">
                        <select id="activityFrequencyUnit" style="flex: 1;">
                            <option value="days">天</option>
                            <option value="weeks" selected>周</option>
                            <option value="months">月</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">添加</button>
                </div>
            </form>
        `;

        document.getElementById('addActivityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addActivity();
        });

        this.openModal();
    }

    addActivity() {
        const activity = {
            name: document.getElementById('activityName').value,
            description: document.getElementById('activityDescription').value,
            frequency: document.getElementById('activityFrequency').value,
            frequencyUnit: document.getElementById('activityFrequencyUnit').value
        };

        this.dataManager.addActivity(activity);
        this.closeModal();
        this.renderActivities();
    }

    editActivity(id) {
        const activity = this.dataManager.activities.find(a => a.id === id);
        if (!activity) return;

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <h2>编辑活动</h2>
            <form id="editActivityForm">
                <div class="form-group">
                    <label>活动名称 *</label>
                    <input type="text" id="activityName" value="${activity.name}" required>
                </div>
                <div class="form-group">
                    <label>活动描述</label>
                    <textarea id="activityDescription" rows="3">${activity.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>活动频率 *</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="activityFrequency" value="${activity.frequency}" min="1" required style="flex: 1;">
                        <select id="activityFrequencyUnit" style="flex: 1;">
                            <option value="days" ${activity.frequencyUnit === 'days' ? 'selected' : ''}>天</option>
                            <option value="weeks" ${activity.frequencyUnit === 'weeks' ? 'selected' : ''}>周</option>
                            <option value="months" ${activity.frequencyUnit === 'months' ? 'selected' : ''}>月</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="uiManager.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        document.getElementById('editActivityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateActivity(id);
        });

        this.openModal();
    }

    updateActivity(id) {
        const updates = {
            name: document.getElementById('activityName').value,
            description: document.getElementById('activityDescription').value,
            frequency: document.getElementById('activityFrequency').value,
            frequencyUnit: document.getElementById('activityFrequencyUnit').value
        };

        this.dataManager.updateActivity(id, updates);
        this.closeModal();
        this.renderActivities();
    }

    deleteActivity(id) {
        if (confirm('确定要删除这个活动吗？')) {
            this.dataManager.deleteActivity(id);
            this.renderActivities();
        }
    }

    // ==================== 设置管理 ====================
    renderSettings() {
        const settings = this.dataManager.settings;
        document.getElementById('algorithmSelect').value = settings.algorithm;
        document.getElementById('notificationEnabled').checked = settings.notificationEnabled;
        document.getElementById('notificationDays').value = settings.notificationDays;
    }

    exportData() {
        const data = this.dataManager.exportData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scheduling-system-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        alert('数据导出成功！');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.dataManager.importData(data);
                this.renderAll();
                alert('数据导入成功！');
            } catch (error) {
                alert('数据导入失败，请检查文件格式');
            }
        };
        reader.readAsText(file);

        // 重置文件输入
        event.target.value = '';
    }

    clearAllData() {
        if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
            this.dataManager.clearAllData();
            this.renderAll();
            alert('所有数据已清除');
        }
    }

    // ==================== 弹窗管理 ====================
    openModal() {
        document.getElementById('modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }
}

// ==================== 初始化应用 ====================
let dataManager, scheduleGenerator, notificationManager, uiManager;

document.addEventListener('DOMContentLoaded', () => {
    dataManager = new DataManager();
    scheduleGenerator = new ScheduleGenerator(dataManager);
    notificationManager = new NotificationManager(dataManager);
    uiManager = new UIManager(dataManager, scheduleGenerator, notificationManager);

    // 启动通知管理器
    if (dataManager.settings.notificationEnabled) {
        notificationManager.start();
        notificationManager.requestPermission();
    }

    console.log('团队排班系统已启动！');
});
