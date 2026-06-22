document.addEventListener('DOMContentLoaded', () => {
    // State
    let tasks = JSON.parse(localStorage.getItem('taskflow_tasks')) || [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedDate = null;
    let editingTaskId = null;

    // Theme setup
    const savedTheme = localStorage.getItem('taskflow_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon();

    // DOM Elements
    const themeToggleBtn = document.getElementById('theme-toggle');
    const notificationBtn = document.getElementById('notification-btn');
    const taskBoxCollapsed = document.getElementById('task-box-collapsed');
    const taskBoxExpanded = document.getElementById('task-box-expanded');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskTitleInput = document.getElementById('task-title-input');
    const taskDeadlineInput = document.getElementById('task-deadline-input');
    const diffCircles = document.querySelectorAll('.task-box-expanded .diff-circle');
    const taskList = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('global-search');

    // Chart and Calendar vars
    let difficultyChartInstance = null;
    let calendarInstance = null;

    // Modals
    const editModal = document.getElementById('edit-modal');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const editTaskTitle = document.getElementById('edit-task-title');
    const editTaskDeadline = document.getElementById('edit-task-deadline');
    const editDiffCircles = document.querySelectorAll('#edit-modal .diff-circle');

    // Stats
    const statTotal = document.getElementById('stat-total');
    const statCompleted = document.getElementById('stat-completed');
    const statPending = document.getElementById('stat-pending');
    const statOverdue = document.getElementById('stat-overdue');
    const overallPercentage = document.getElementById('overall-percentage');
    const overallProgressBar = document.getElementById('overall-progress-bar');

    // Calendar Side Panels
    const dateCreatedList = document.getElementById('created-on-list');
    const dateDeadlineList = document.getElementById('deadline-on-list');
    const selectedDateTexts = document.querySelectorAll('.selected-date-text');

    // Initialize
    initChart();
    initCalendar();
    renderTasks();
    updateStats();

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    setInterval(checkDeadlines, 30000);
    setTimeout(checkDeadlines, 2000);

    // --- Event Listeners --- //

    // Theme Toggle
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('taskflow_theme', newTheme);
        updateThemeIcon();
        updateChartColors();
    });

    function updateThemeIcon() {
        const themeIcon = document.getElementById('theme-icon');
        const currentTheme = document.body.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            themeIcon.className = 'fa-solid fa-moon';
        } else {
            themeIcon.className = 'fa-solid fa-sun';
        }
    }

    // Notification Click
    notificationBtn.addEventListener('click', () => {
        const overdueCount = tasks.filter(t => isOverdue(t.deadline, t.status)).length;
        if (overdueCount > 0) {
            showToast(`You have ${overdueCount} overdue task(s)!`, 'error');
        } else {
            showToast('No new notifications', 'info');
        }
    });

    // Task Box Expansion
    taskBoxCollapsed.addEventListener('click', () => {
        taskBoxCollapsed.classList.add('hidden');
        taskBoxExpanded.classList.remove('hidden');
        taskTitleInput.focus();
        // default select medium
        diffCircles.forEach(c => c.classList.remove('selected'));
        document.querySelector('.task-box-expanded .diff-circle.medium').classList.add('selected');
    });

    cancelTaskBtn.addEventListener('click', () => {
        taskBoxExpanded.classList.add('hidden');
        taskBoxCollapsed.classList.remove('hidden');
        resetTaskInput();
    });

    // Difficulty Selection
    diffCircles.forEach(circle => {
        circle.addEventListener('click', (e) => {
            diffCircles.forEach(c => c.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });

    editDiffCircles.forEach(circle => {
        circle.addEventListener('click', (e) => {
            editDiffCircles.forEach(c => c.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });

    // Add Task
    addTaskBtn.addEventListener('click', () => {
        const title = taskTitleInput.value.trim();
        if (!title) {
            showToast('Task title cannot be empty', 'error');
            return;
        }

        const selectedDiff = document.querySelector('.task-box-expanded .diff-circle.selected');
        const difficulty = selectedDiff ? selectedDiff.dataset.diff : 'medium';
        const deadline = taskDeadlineInput.value;

        const newTask = {
            id: Date.now().toString(),
            title,
            difficulty,
            createdAt: new Date().toISOString(),
            deadline: deadline ? new Date(deadline).toISOString() : null,
            status: 'active'
        };

        tasks.unshift(newTask);
        saveTasks();
        renderTasks();
        updateStats();
        updateCalendarEvents();
        
        taskBoxExpanded.classList.add('hidden');
        taskBoxCollapsed.classList.remove('hidden');
        resetTaskInput();
        showToast('Task created successfully', 'success');
    });

    // Filtering
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    // Searching
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTasks();
    });

    // Edit Modal
    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
        editingTaskId = null;
    });

    saveEditBtn.addEventListener('click', () => {
        if (!editingTaskId) return;
        const title = editTaskTitle.value.trim();
        if (!title) {
            showToast('Task title cannot be empty', 'error');
            return;
        }

        const selectedDiff = document.querySelector('#edit-modal .diff-circle.selected');
        const difficulty = selectedDiff ? selectedDiff.dataset.diff : 'medium';
        const deadline = editTaskDeadline.value;

        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex > -1) {
            tasks[taskIndex].title = title;
            tasks[taskIndex].difficulty = difficulty;
            const newDeadlineStr = deadline ? new Date(deadline).toISOString() : null;
            if (tasks[taskIndex].deadline !== newDeadlineStr) {
                tasks[taskIndex].notified = false;
            }
            tasks[taskIndex].deadline = newDeadlineStr;
            
            saveTasks();
            renderTasks();
            updateStats();
            updateCalendarEvents();
            showToast('Task updated successfully', 'success');
        }

        editModal.classList.add('hidden');
        editingTaskId = null;
    });

    // --- Core Functions --- //

    function sendDesktopNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body });
        }
    }

    function checkDeadlines() {
        const now = new Date();
        let updated = false;

        tasks.forEach(task => {
            if (task.status === 'active' && task.deadline && !task.notified) {
                const deadlineDate = new Date(task.deadline);
                if (now >= deadlineDate) {
                    task.notified = true;
                    updated = true;
                    sendDesktopNotification('Task Deadline Reached!', `The deadline for "${task.title}" has passed.`);
                }
            }
        });

        if (updated) {
            saveTasks();
            renderTasks();
            updateStats();
        }
    }

    function resetTaskInput() {
        taskTitleInput.value = '';
        taskDeadlineInput.value = '';
        diffCircles.forEach(c => c.classList.remove('selected'));
    }

    function saveTasks() {
        localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
        if (selectedDate) updateCalendarSidePanels(selectedDate);
    }

    function isOverdue(deadlineStr, status) {
        if (status === 'completed' || !deadlineStr) return false;
        return new Date(deadlineStr) < new Date();
    }

    function getLocalDateString(isoStr) {
        if (!isoStr) return null;
        const d = new Date(isoStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        const date = new Date(isoStr);
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        let formatted = date.toLocaleDateString('en-GB', options);
        // Include time if not midnight
        if (date.getHours() !== 0 || date.getMinutes() !== 0) {
            formatted += ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return formatted;
    }

    function renderTasks() {
        taskList.innerHTML = '';
        
        let filteredTasks = tasks.filter(task => {
            if (currentFilter === 'active' && task.status !== 'active') return false;
            if (currentFilter === 'completed' && task.status !== 'completed') return false;
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery)) return false;
            return true;
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<div class="empty-state">No tasks found</div>';
            return;
        }

        filteredTasks.forEach(task => {
            const overdue = isOverdue(task.deadline, task.status);
            const isCompleted = task.status === 'completed';
            
            const card = document.createElement('div');
            card.className = `task-card glass-panel diff-${task.difficulty} ${isCompleted ? 'completed' : ''} ${overdue ? 'overdue' : ''}`;
            
            card.innerHTML = `
                <div class="task-checkbox-container" onclick="toggleTaskStatus('${task.id}')">
                    <div class="custom-checkbox">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <div class="meta-item"><i class="fa-regular fa-clock"></i> Created: ${formatDate(task.createdAt)}</div>
                        ${task.deadline ? `<div class="meta-item"><i class="fa-regular fa-calendar"></i> Deadline: ${formatDate(task.deadline)}</div>` : ''}
                        ${overdue ? `<div class="overdue-badge"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</div>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit" onclick="openEditModal('${task.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="task-action-btn delete" onclick="deleteTask('${task.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            
            taskList.appendChild(card);
        });
    }

    // Expose functions to global scope for inline onclick handlers
    window.toggleTaskStatus = (id) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = task.status === 'completed' ? 'active' : 'completed';
            saveTasks();
            renderTasks();
            updateStats();
            updateCalendarEvents();
            
            if (task.status === 'completed') {
                showToast('Task completed!', 'success');
            } else {
                showToast('Task marked as active', 'info');
            }
        }
    };

    window.deleteTask = (id) => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
        updateStats();
        updateCalendarEvents();
        showToast('Task deleted', 'success');
    };

    window.openEditModal = (id) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            editingTaskId = id;
            editTaskTitle.value = task.title;
            
            // Format deadline for datetime-local input
            if (task.deadline) {
                const d = new Date(task.deadline);
                const isoString = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                editTaskDeadline.value = isoString;
            } else {
                editTaskDeadline.value = '';
            }

            editDiffCircles.forEach(c => c.classList.remove('selected'));
            document.querySelector(`#edit-modal .diff-circle.${task.difficulty}`).classList.add('selected');

            editModal.classList.remove('hidden');
        }
    };

    // --- Analytics & Stats --- //

    function updateStats() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = total - completed;
        const overdue = tasks.filter(t => isOverdue(t.deadline, t.status)).length;

        statTotal.textContent = total;
        statCompleted.textContent = completed;
        statPending.textContent = pending;
        statOverdue.textContent = overdue;

        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        overallPercentage.textContent = `${percentage}%`;
        overallProgressBar.style.width = `${percentage}%`;

        // Update Notification Badge
        const badge = document.getElementById('notification-badge');
        if (overdue > 0) {
            badge.textContent = overdue;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        updateChartData();
    }

    function initChart() {
        const ctx = document.getElementById('difficultyChart').getContext('2d');
        
        Chart.defaults.color = document.body.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b';
        Chart.defaults.font.family = 'Inter';

        difficultyChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Hard', 'Medium', 'Easy'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#EF4444', '#FACC15', '#22C55E'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    function updateChartData() {
        if (!difficultyChartInstance) return;

        const hard = tasks.filter(t => t.difficulty === 'hard').length;
        const medium = tasks.filter(t => t.difficulty === 'medium').length;
        const easy = tasks.filter(t => t.difficulty === 'easy').length;

        difficultyChartInstance.data.datasets[0].data = [hard, medium, easy];
        difficultyChartInstance.update();
    }

    function updateChartColors() {
        if (difficultyChartInstance) {
            difficultyChartInstance.options.plugins.legend.labels.color = 
                document.body.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b';
            difficultyChartInstance.update();
        }
    }

    // --- Calendar --- //

    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            height: 'auto',
            dayCellClassNames: function(arg) {
                // Check if date has deadline
                const year = arg.date.getFullYear();
                const month = String(arg.date.getMonth() + 1).padStart(2, '0');
                const day = String(arg.date.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                const hasDeadline = tasks.some(t => {
                    if (t.status === 'completed' || !t.deadline) return false;
                    return getLocalDateString(t.deadline) === dateStr;
                });
                
                let classes = [];
                if (hasDeadline) classes.push('has-deadline');
                
                // Add selected class
                if (selectedDate && dateStr === selectedDate) {
                    classes.push('fc-day-selected');
                }
                
                return classes;
            },
            dateClick: function(info) {
                // Remove previous selected visual
                document.querySelectorAll('.fc-day-selected').forEach(el => el.classList.remove('fc-day-selected'));
                info.dayEl.classList.add('fc-day-selected');
                
                selectedDate = info.dateStr;
                updateCalendarSidePanels(selectedDate);
            }
        });
        calendarInstance.render();
    }

    function updateCalendarEvents() {
        if (calendarInstance) {
            // Re-evaluating dayCellClassNames requires a rerender of current view
            calendarInstance.render();
        }
    }

    function updateCalendarSidePanels(dateStr) {
        const [year, month, day] = dateStr.split('-');
        const displayDate = new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        selectedDateTexts.forEach(el => el.textContent = displayDate);

        // Created On
        const createdTasks = tasks.filter(t => getLocalDateString(t.createdAt) === dateStr);
        renderMicroTasks(dateCreatedList, createdTasks);

        // Deadline On
        const deadlineTasks = tasks.filter(t => getLocalDateString(t.deadline) === dateStr);
        renderMicroTasks(dateDeadlineList, deadlineTasks);
    }

    function renderMicroTasks(container, taskList) {
        container.innerHTML = '';
        if (taskList.length === 0) {
            container.innerHTML = '<div class="empty-state">No tasks for this date</div>';
            return;
        }

        taskList.forEach(task => {
            const el = document.createElement('div');
            el.className = `micro-task diff-${task.difficulty} ${task.status === 'completed' ? 'completed' : ''}`;
            el.innerHTML = `
                <div class="micro-task-title">${task.title}</div>
                <div class="micro-task-meta">Status: ${task.status}</div>
            `;
            container.appendChild(el);
        });
    }

    // --- Utilities --- //

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color: var(--easy)"></i>' : 
                   type === 'error' ? '<i class="fa-solid fa-circle-exclamation" style="color: var(--hard)"></i>' :
                   '<i class="fa-solid fa-circle-info" style="color: var(--accent)"></i>';
                   
        toast.innerHTML = `${icon} <span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
