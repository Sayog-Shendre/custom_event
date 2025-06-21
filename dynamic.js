class EventCalendar {
    constructor() {
        this.currentDate = new Date();
        this.events = this.loadEvents();
        this.currentEditingEvent = null;
        this.draggedEvent = null;
        this.searchQuery = '';
        
        this.initializeEventListeners();
        this.render();
    }

    initializeEventListeners() {
        // Navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.previousMonth());
        document.getElementById('nextMonth').addEventListener('click', () => this.nextMonth());
        document.getElementById('today').addEventListener('click', () => this.goToToday());

        // Modal controls
        document.getElementById('addEventBtn').addEventListener('click', () => this.openAddEventModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteEvent());

        // Form submission
        document.getElementById('eventForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Recurrence options
        document.getElementById('eventRecurrence').addEventListener('change', (e) => this.handleRecurrenceChange(e));

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e));

        // Modal backdrop click
        document.getElementById('eventModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('eventModal')) {
                this.closeModal();
            }
        });

        // Form validation
        document.getElementById('eventTitle').addEventListener('input', () => this.validateForm());
        document.getElementById('eventDate').addEventListener('change', () => this.checkConflicts());
        document.getElementById('eventTime').addEventListener('change', () => this.checkConflicts());
    }

    render() {
        this.showLoading();
        setTimeout(() => {
            this.renderCalendar();
            this.hideLoading();
        }, 300);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('calendar').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('calendar').style.display = 'grid';
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        const monthYear = document.getElementById('monthYear');
        
        // Update month/year display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        monthYear.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;

        // Clear calendar
        calendar.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendar.appendChild(dayHeader);
        });

        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Render 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            this.renderDay(date, calendar);
        }
    }

    renderDay(date, calendar) {
        const day = document.createElement('div');
        day.className = 'day';
        day.dataset.date = this.formatDate(date);
        
        // Add classes for styling
        if (date.getMonth() !== this.currentDate.getMonth()) {
            day.classList.add('other-month');
        }
        
        if (this.isToday(date)) {
            day.classList.add('today');
        }

        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        day.appendChild(dayNumber);

        // Events container
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events';
        day.appendChild(eventsContainer);

        // Add events for this day
        const dayEvents = this.getEventsForDate(date);
        dayEvents.forEach(event => {
            if (this.searchQuery === '' || this.matchesSearch(event)) {
                const eventElement = this.createEventElement(event);
                eventsContainer.appendChild(eventElement);
            }
        });

        // Event listeners
        day.addEventListener('click', (e) => {
            if (e.target === day || e.target === dayNumber) {
                this.openAddEventModal(date);
            }
        });

        // Drag and drop
        day.addEventListener('dragover', (e) => this.handleDragOver(e));
        day.addEventListener('drop', (e) => this.handleDrop(e, date));

        calendar.appendChild(day);
    }

    createEventElement(event) {
        const eventEl = document.createElement('div');
        eventEl.className = `event category-${event.category}`;
        eventEl.textContent = event.title;
        eventEl.draggable = true;
        eventEl.dataset.eventId = event.id;
        
        if (event.recurrence && event.recurrence !== 'none') {
            eventEl.classList.add('recurring');
        }

        eventEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditEventModal(event);
        });

        eventEl.addEventListener('dragstart', (e) => this.handleDragStart(e, event));
        eventEl.addEventListener('dragend', (e) => this.handleDragEnd(e));

        return eventEl;
    }

    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => {
            if (event.date === dateStr) return true;
            return this.isRecurringEventOnDate(event, date);
        });
    }

    isRecurringEventOnDate(event, date) {
        if (!event.recurrence || event.recurrence === 'none') return false;

        const eventDate = new Date(event.date);
        if (date < eventDate) return false;

        switch (event.recurrence) {
            case 'daily':
                return true;
            
            case 'weekly':
                if (event.weeklyDays) {
                    return event.weeklyDays.includes(date.getDay());
                }
                return date.getDay() === eventDate.getDay();
            
            case 'monthly':
                return date.getDate() === eventDate.getDate();
            
            case 'custom':
                return this.isCustomRecurringEventOnDate(event, eventDate, date);
        }
        return false;
    }

    isCustomRecurringEventOnDate(event, eventDate, date) {
        const interval = event.customInterval || 1;
        const unit = event.customUnit || 'days';
        
        const daysDiff = Math.floor((date - eventDate) / (1000 * 60 * 60 * 24));
        
        switch (unit) {
            case 'days':
                return daysDiff % interval === 0;
            case 'weeks':
                return daysDiff % (interval * 7) === 0;
            case 'months':
                const monthsDiff = (date.getFullYear() - eventDate.getFullYear()) * 12 + 
                                 (date.getMonth() - eventDate.getMonth());
                return monthsDiff % interval === 0 && date.getDate() === eventDate.getDate();
        }
        return false;
    }

    openAddEventModal(date = null) {
        this.currentEditingEvent = null;
        document.getElementById('modalTitle').textContent = 'Add Event';
        document.getElementById('deleteBtn').style.display = 'none';
        
        // Reset form
        document.getElementById('eventForm').reset();
        
        if (date) {
            document.getElementById('eventDate').value = this.formatDate(date);
        }
        
        this.showModal();
    }

    openEditEventModal(event) {
        this.currentEditingEvent = event;
        document.getElementById('modalTitle').textContent = 'Edit Event';
        document.getElementById('deleteBtn').style.display = 'inline-block';
        
        // Populate form
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventCategory').value = event.category || 'personal';
        document.getElementById('eventRecurrence').value = event.recurrence || 'none';
        
        this.handleRecurrenceChange({ target: { value: event.recurrence } });
        
        if (event.recurrence === 'weekly' && event.weeklyDays) {
            event.weeklyDays.forEach(day => {
                const checkbox = document.querySelector(`input[value="${day}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        if (event.recurrence === 'custom') {
            document.getElementById('customInterval').value = event.customInterval || 1;
            document.getElementById('customUnit').value = event.customUnit || 'days';
        }
        
        this.showModal();
        this.checkConflicts();
    }

    showModal() {
        document.getElementById('eventModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            document.getElementById('eventTitle').focus();
        }, 100);
    }

    closeModal() {
        document.getElementById('eventModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('conflictWarning').style.display = 'none';
        this.currentEditingEvent = null;
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const eventData = {
            id: this.currentEditingEvent ? this.currentEditingEvent.id : this.generateId(),
            title: formData.get('title'),
            date: formData.get('date'),
            time: formData.get('time'),
            description: formData.get('description'),
            category: formData.get('category'),
            recurrence: formData.get('recurrence')
        };

        // Handle weekly recurrence
        if (eventData.recurrence === 'weekly') {
            const weeklyDays = [];
            const checkboxes = document.querySelectorAll('#weeklyOptions input[type="checkbox"]:checked');
            checkboxes.forEach(cb => weeklyDays.push(parseInt(cb.value)));
            eventData.weeklyDays = weeklyDays;
        }

        // Handle custom recurrence
        if (eventData.recurrence === 'custom') {
            eventData.customInterval = parseInt(document.getElementById('customInterval').value);
            eventData.customUnit = document.getElementById('customUnit').value;
        }

        if (this.currentEditingEvent) {
            this.updateEvent(eventData);
        } else {
            this.addEvent(eventData);
        }

        this.closeModal();
        this.render();
    }

    addEvent(eventData) {
        this.events.push(eventData);
        this.saveEvents();
        this.showNotification('Event added successfully!', 'success');
    }

    updateEvent(eventData) {
        const index = this.events.findIndex(e => e.id === eventData.id);
        if (index !== -1) {
            this.events[index] = eventData;
            this.saveEvents();
            this.showNotification('Event updated successfully!', 'success');
        }
    }

    deleteEvent() {
        if (this.currentEditingEvent) {
            const index = this.events.findIndex(e => e.id === this.currentEditingEvent.id);
            if (index !== -1) {
                this.events.splice(index, 1);
                this.saveEvents();
                this.showNotification('Event deleted successfully!', 'success');
                this.closeModal();
                this.render();
            }
        }
    }

    handleRecurrenceChange(e) {
        const recurrenceOptions = document.getElementById('recurrenceOptions');
        const weeklyOptions = document.getElementById('weeklyOptions');
        const customOptions = document.getElementById('customOptions');
        
        // Reset all options
        recurrenceOptions.style.display = 'none';
        weeklyOptions.style.display = 'none';
        customOptions.style.display = 'none';
        
        if (e.target.value !== 'none') {
            recurrenceOptions.style.display = 'block';
            
            if (e.target.value === 'weekly') {
                weeklyOptions.style.display = 'block';
            } else if (e.target.value === 'custom') {
                customOptions.style.display = 'block';
            }
        }
    }

    handleSearch(e) {
        this.searchQuery = e.target.value.toLowerCase();
        this.render();
    }

    matchesSearch(event) {
        return event.title.toLowerCase().includes(this.searchQuery) ||
               (event.description && event.description.toLowerCase().includes(this.searchQuery));
    }

    checkConflicts() {
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const conflictWarning = document.getElementById('conflictWarning');
        
        if (!date || !time) {
            conflictWarning.style.display = 'none';
            return;
        }

        const conflicts = this.events.filter(event => {
            if (this.currentEditingEvent && event.id === this.currentEditingEvent.id) {
                return false;
            }
            return event.date === date && event.time === time;
        });

        if (conflicts.length > 0) {
            conflictWarning.style.display = 'block';
        } else {
            conflictWarning.style.display = 'none';
        }
    }

    validateForm() {
        const title = document.getElementById('eventTitle').value;
        const submitBtn = document.querySelector('.btn-primary');
        
        if (title.trim().length > 0) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        }
    }

    // Drag and Drop functionality
    handleDragStart(e, event) {
        this.draggedEvent = event;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedEvent = null;
        
        // Remove drop zones
        document.querySelectorAll('.drop-zone').forEach(el => {
            el.classList.remove('drop-zone');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (this.draggedEvent) {
            e.currentTarget.classList.add('drop-zone');
        }
    }

    handleDrop(e, date) {
        e.preventDefault();
        e.currentTarget.classList.remove('drop-zone');
        
        if (this.draggedEvent) {
            const newDate = this.formatDate(date);
            if (newDate !== this.draggedEvent.date) {
                const eventIndex = this.events.findIndex(ev => ev.id === this.draggedEvent.id);
                if (eventIndex !== -1) {
                    this.events[eventIndex].date = newDate;
                    this.saveEvents();
                    this.showNotification('Event moved successfully!', 'success');
                    this.render();
                }
            }
        }
    }

    // Navigation methods
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }

    goToToday() {
        this.currentDate = new Date();
        this.render();
    }

    // FIXED: Utility methods with timezone fix
    formatDate(date) {
        // Use local timezone instead of UTC to avoid date shifting
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    isToday(date) {
        // Use component comparison instead of string comparison for better accuracy
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
               date.getMonth() === today.getMonth() &&
               date.getDate() === today.getDate();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 3000;
            font-weight: bold;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Data persistence
    saveEvents() {
        try {
            const eventsData = {
                events: this.events,
                timestamp: Date.now()
            };
            const dataString = JSON.stringify(eventsData);
            
            // Simple in-memory storage simulation
            window.calendarData = dataString;
            
            // For demonstration, also log to console
            console.log('Events saved:', this.events.length, 'events');
        } catch (error) {
            console.error('Error saving events:', error);
            this.showNotification('Error saving events', 'error');
        }
    }

    loadEvents() {
        try {
            // Load from in-memory storage
            const dataString = window.calendarData;
            if (dataString) {
                const data = JSON.parse(dataString);
                console.log('Events loaded:', data.events.length, 'events');
                return data.events || [];
            }
            
            // Return sample events for demonstration
            return this.getSampleEvents();
        } catch (error) {
            console.error('Error loading events:', error);
            return this.getSampleEvents();
        }
    }

    getSampleEvents() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        return [
            {
                id: this.generateId(),
                title: 'Team Meeting',
                date: this.formatDate(today),
                time: '10:00',
                description: 'Weekly team sync meeting',
                category: 'work',
                recurrence: 'weekly',
                weeklyDays: [today.getDay()]
            },
            {
                id: this.generateId(),
                title: 'Gym Workout',
                date: this.formatDate(tomorrow),
                time: '07:00',
                description: 'Morning workout session',
                category: 'health',
                recurrence: 'daily'
            },
            {
                id: this.generateId(),
                title: 'Project Deadline',
                date: this.formatDate(nextWeek),
                time: '17:00',
                description: 'Submit final project deliverables',
                category: 'work',
                recurrence: 'none'
            }
        ];
    }

    // Advanced features
    exportEvents() {
        const dataStr = JSON.stringify(this.events, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'calendar-events.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    importEvents(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedEvents = JSON.parse(e.target.result);
                this.events = [...this.events, ...importedEvents];
                this.saveEvents();
                this.render();
                this.showNotification(`Imported ${importedEvents.length} events successfully!`, 'success');
            } catch (error) {
                this.showNotification('Error importing events', 'error');
            }
        };
        reader.readAsText(file);
    }

    getEventStats() {
        const stats = {
            total: this.events.length,
            byCategory: {},
            recurring: this.events.filter(e => e.recurrence !== 'none').length,
            thisMonth: 0
        };

        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();

        this.events.forEach(event => {
            // Category stats
            stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
            
            // This month stats
            const eventDate = new Date(event.date);
            if (eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear) {
                stats.thisMonth++;
            }
        });

        return stats;
    }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.eventCalendar = new EventCalendar();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    window.eventCalendar.openAddEventModal();
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            window.eventCalendar.closeModal();
        }
    });

    // Add touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next month
                window.eventCalendar.nextMonth();
            } else {
                // Swipe right - previous month
                window.eventCalendar.previousMonth();
            }
        }
    }

    // Performance optimization - debounce search
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            window.eventCalendar.handleSearch(e);
        }, 150);
    });

    // Add context menu for additional options
    document.addEventListener('contextmenu', (e) => {
        if (e.target.classList.contains('event')) {
            e.preventDefault();
            // Could add context menu here for advanced options
        }
    });

    console.log('🗓️ Dynamic Event Calendar initialized successfully!');
    console.log('📝 Keyboard shortcuts: Ctrl+N (new event), Ctrl+F (search), ESC (close modal)');
    console.log('📱 Mobile: Swipe left/right to navigate months');
});