// ============================================================================
// Hospital Management System - Frontend Vue 3 Application
// Beginner-friendly implementation using Vue Options API
//
// REFERENCE DOCUMENTATION
// Vue 3: https://vuejs.org/guide/introduction.html
// Vue Options API: https://vuejs.org/guide/introduction.html#options-api
// JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript
// Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
// ============================================================================

const { createApp } = Vue;

createApp({
  // --------------------------------------------------------------------------
  // DATA: Reactive application state
  //
  // References:
  // Vue data option:
  // https://vuejs.org/api/options-state.html#data
  // Vue reactivity:
  // https://vuejs.org/guide/essentials/reactivity-fundamentals.html
  // --------------------------------------------------------------------------
  data() {
    return {
      // Current active navigation tab: 'dashboard' | 'patients' | 'doctors' | 'appointments' | 'beds'
      activeTab: 'dashboard',

      // Data collections fetched from MySQL via Express REST API
      patients: [],
      doctors: [],
      appointments: [],
      beds: [],

      // Loading and notification alert state
      loading: false,
      alert: {
        show: false,
        message: '',
        type: 'success' // 'success' | 'danger' | 'warning' | 'info'
      },

      // Patient Form Model (used for both Add and Edit)
      patientForm: {
        id: null,
        name: '',
        age: '',
        gender: 'Male',
        contact: '',
        address: '',
        department: 'Cardiology',
        admission_date: '',
        assigned_doctor: '',
        status: 'Admitted',
        batch: 'Morning Batch'
      },
      isEditingPatient: false,

      // Appointment Form Model
      appointmentForm: {
        patient_name: '',
        doctor_name: '',
        appointment_date: '',
        appointment_time: '10:00 AM',
        department: 'Cardiology',
        status: 'Pending'
      },

      // Search & Filtering Models (for Vue computed properties)
      patientSearch: '',
      patientFilterDept: '',
      patientFilterBatch: '',
      appointmentFilterStatus: '',
      appointmentFilterDate: '',

      // Batch Allocation Model (Scheduling groups demo)
      selectedBatchForAllocation: 'Morning Batch',

      // Display preference: toggle uppercase display of patient names
      showUppercase: false,

      // Drag and Drop state
      draggedPatient: null,

      // HTML5 Geolocation state
      userLocation: null,
      locationStatus: '',
      locationError: '',

      // UI Preferences stored in browser LocalStorage
      theme: 'light'
    };
  },

  // --------------------------------------------------------------------------
  // COMPUTED PROPERTIES
  //
  // References:
  // Vue computed properties:
  // https://vuejs.org/guide/essentials/computed.html
  // JavaScript Array methods:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
  // --------------------------------------------------------------------------
  computed: {
    // Dashboard Summary Counters
    totalPatients() {
      return this.patients.length;
    },

    totalDoctors() {
      return this.doctors.length;
    },

    totalAppointments() {
      return this.appointments.length;
    },

    availableBedsCount() {
      return this.beds.filter(bed => bed.status === 'Available').length;
    },

    occupiedBedsCount() {
      return this.beds.filter(bed => bed.status === 'Occupied').length;
    },

    // First 5 patients for the dashboard recent list
    recentPatients() {
      return this.patients.slice(0, 5);
    },

    // Admitted patients (available to be dragged into hospital beds)
    admittedPatients() {
      return this.patients.filter(patient => patient.status === 'Admitted');
    },

    // Filtered Patients List (Combines Search + Department + Batch filters)
    filteredPatients() {
      return this.patients.filter(patient => {
        // Search filter by Name or ID
        const searchLower = this.patientSearch.toLowerCase().trim();
        const matchesSearch = !searchLower ||
          patient.name.toLowerCase().includes(searchLower) ||
          String(patient.id).includes(searchLower);

        // Filter by Department
        const matchesDept = !this.patientFilterDept ||
          patient.department === this.patientFilterDept;

        // Filter by Batch
        const matchesBatch = !this.patientFilterBatch ||
          patient.batch === this.patientFilterBatch;

        return matchesSearch && matchesDept && matchesBatch;
      });
    },

    // Filtered Appointments List (Status and Date)
    filteredAppointments() {
      return this.appointments.filter(apt => {
        // Filter by Status
        const matchesStatus = !this.appointmentFilterStatus ||
          apt.status === this.appointmentFilterStatus;

        // Filter by Date
        const matchesDate = !this.appointmentFilterDate ||
          apt.appointment_date === this.appointmentFilterDate;

        return matchesStatus && matchesDate;
      });
    }
  },

  // --------------------------------------------------------------------------
  // METHODS
  //
  // References:
  // Vue methods:
  // https://vuejs.org/guide/essentials/event-handling.html
  // JavaScript functions:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions
  // --------------------------------------------------------------------------
  methods: {
    // ========================================================================
    // NOTIFICATION HELPER
    //
    // References:
    // JavaScript setTimeout():
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
    // Bootstrap alerts:
    // https://getbootstrap.com/docs/5.3/components/alerts/
    // ========================================================================
    showAlert(message, type = 'success') {
      this.alert.message = message;
      this.alert.type = type;
      this.alert.show = true;

      // Auto-dismiss notification after 4 seconds
      setTimeout(() => {
        if (this.alert.message === message) {
          this.alert.show = false;
        }
      }, 4000);
    },

    closeAlert() {
      this.alert.show = false;
    },

    // ========================================================================
    // DATA LOADING WITH FETCH API
    //
    // References:
    // Fetch API:
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
    // Using Fetch:
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    // HTTP response.ok:
    // https://developer.mozilla.org/en-US/docs/Web/API/Response/ok
    // Promise.all():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    // ========================================================================
    async loadPatients() {
      try {
        const response = await fetch('/api/patients');
        if (!response.ok) throw new Error('Failed to load patients');
        this.patients = await response.json();
      } catch (err) {
        console.error('loadPatients error:', err);
        this.showAlert('Could not load patient list from database', 'danger');
      }
    },

    async loadDoctors() {
      try {
        const response = await fetch('/api/doctors');
        if (!response.ok) throw new Error('Failed to load doctors');
        this.doctors = await response.json();

        // Set default doctor in form if available and empty
        if (this.doctors.length > 0 && !this.patientForm.assigned_doctor) {
          this.patientForm.assigned_doctor = this.doctors[0].name;
          this.appointmentForm.doctor_name = this.doctors[0].name;
        }
      } catch (err) {
        console.error('loadDoctors error:', err);
      }
    },

    async loadAppointments() {
      try {
        const response = await fetch('/api/appointments');
        if (!response.ok) throw new Error('Failed to load appointments');
        this.appointments = await response.json();
      } catch (err) {
        console.error('loadAppointments error:', err);
      }
    },

    async loadBeds() {
      try {
        const response = await fetch('/api/beds');
        if (!response.ok) throw new Error('Failed to load beds');
        this.beds = await response.json();
      } catch (err) {
        console.error('loadBeds error:', err);
      }
    },

    async loadAllData() {
      this.loading = true;
      await Promise.all([
        this.loadPatients(),
        this.loadDoctors(),
        this.loadAppointments(),
        this.loadBeds()
      ]);
      this.loading = false;
    },

    // ========================================================================
    // PATIENT MANAGEMENT: ADD AND EDIT
    //
    // References:
    // Fetch POST and PUT requests:
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    // JSON.stringify():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
    // Spread syntax:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
    // ========================================================================
    async savePatient() {
      try {
        if (this.isEditingPatient) {
          // Update existing patient via PUT request
          const response = await fetch(`/api/patients/${this.patientForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.patientForm)
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to update patient');
          }

          this.showAlert(`Patient "${this.patientForm.name}" updated successfully!`, 'success');
        } else {
          // Register new patient via POST request
          const response = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.patientForm)
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to add patient');
          }

          this.showAlert(`Patient "${this.patientForm.name}" registered successfully!`, 'success');
        }

        // Reset form and reload patient list
        this.resetPatientForm();
        await this.loadPatients();
        await this.loadBeds(); // Refresh beds in case patient details changed
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    },

    editPatient(patient) {
      // Clone patient object into form model
      this.patientForm = { ...patient };
      this.isEditingPatient = true;
      this.activeTab = 'patients';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    cancelEditPatient() {
      this.resetPatientForm();
    },

    resetPatientForm() {
      const today = new Date().toISOString().split('T')[0];
      this.patientForm = {
        id: null,
        name: '',
        age: '',
        gender: 'Male',
        contact: '',
        address: '',
        department: 'Cardiology',
        admission_date: today,
        assigned_doctor: this.doctors.length > 0 ? this.doctors[0].name : '',
        status: 'Admitted',
        batch: this.selectedBatchForAllocation || 'Morning Batch'
      };
      this.isEditingPatient = false;
    },

    // ========================================================================
    // PATIENT DELETION
    //
    // References:
    // Window.confirm():
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm
    // HTTP DELETE method:
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/DELETE
    // ========================================================================
    async deletePatient(patientId) {
      const confirmed = window.confirm(
        `Are you sure you want to delete patient #${patientId}? If this patient is assigned to a bed, the bed will be released.`
      );
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/patients/${patientId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete patient record');
        }

        this.showAlert(`Patient #${patientId} deleted successfully`, 'success');
        await this.loadPatients();
        await this.loadBeds();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    },

    // ========================================================================
    // BATCH ALLOCATION
    //
    // Reference:
    // Vue event handling:
    // https://vuejs.org/guide/essentials/event-handling.html
    // ========================================================================
    async assignBatch(patient, newBatch) {
      try {
        const updatedPatient = { ...patient, batch: newBatch };
        const response = await fetch(`/api/patients/${patient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPatient)
        });

        if (!response.ok) throw new Error('Failed to update patient batch');

        this.showAlert(`Assigned "${patient.name}" to ${newBatch}`, 'info');
        await this.loadPatients();
        this.savePreferences();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    },

    // ========================================================================
    // APPOINTMENT MANAGEMENT
    //
    // References:
    // JavaScript Date:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
    // Array.find():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
    // ========================================================================
    async saveAppointment() {
      try {
        const response = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.appointmentForm)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to book appointment');
        }

        this.showAlert(`Appointment for "${this.appointmentForm.patient_name}" booked!`, 'success');
        this.resetAppointmentForm();
        await this.loadAppointments();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    },

    resetAppointmentForm() {
      const today = new Date().toISOString().split('T')[0];
      this.appointmentForm = {
        patient_name: '',
        doctor_name: this.doctors.length > 0 ? this.doctors[0].name : '',
        appointment_date: today,
        appointment_time: '10:00 AM',
        department: 'Cardiology',
        status: 'Pending'
      };
    },

    // Automatically update department when a doctor is picked in appointment form
    onDoctorChange() {
      const selectedDoc = this.doctors.find(d => d.name === this.appointmentForm.doctor_name);
      if (selectedDoc) {
        this.appointmentForm.department = selectedDoc.department;
      }
    },

    // ========================================================================
    // HTML5 DRAG AND DROP: BED ALLOCATION
    //
    // References:
    // HTML Drag and Drop API:
    // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
    // DataTransfer:
    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer
    // ========================================================================
    handleDragStart(event, patient) {
      this.draggedPatient = patient;

      // Store patient ID in HTML5 dataTransfer payload
      event.dataTransfer.setData('text/plain', String(patient.id));
      event.dataTransfer.effectAllowed = 'move';
    },

    handleDragOver(event) {
      // Required by HTML5 Drag & Drop specification to permit dropping
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },

    async handleDrop(event, bed) {
      event.preventDefault();

      if (!this.draggedPatient) {
        return;
      }

      // Check if bed is already occupied
      if (bed.status === 'Occupied') {
        this.showAlert(
          `Cannot allocate Bed ${bed.bed_number}: It is already occupied by ${bed.patient_name || 'another patient'}!`,
          'danger'
        );
        this.draggedPatient = null;
        return;
      }

      // Bed is available: update allocation in MySQL database
      try {
        const response = await fetch(`/api/beds/${bed.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Occupied',
            patient_id: this.draggedPatient.id,
            patient_name: this.draggedPatient.name
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to allocate bed');
        }

        this.showAlert(
          `Success: Patient "${this.draggedPatient.name}" assigned to Bed ${bed.bed_number} (${bed.ward_name})!`,
          'success'
        );

        // Refresh beds from backend
        await this.loadBeds();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      } finally {
        this.draggedPatient = null;
      }
    },

    async releaseBed(bed) {
      const confirmed = window.confirm(`Release Bed ${bed.bed_number} (${bed.ward_name})?`);
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/beds/${bed.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Available',
            patient_id: null,
            patient_name: null
          })
        });

        if (!response.ok) throw new Error('Failed to release bed');

        this.showAlert(`Bed ${bed.bed_number} is now Available.`, 'info');
        await this.loadBeds();
      } catch (err) {
        this.showAlert(err.message, 'danger');
      }
    },

    // ========================================================================
    // HTML5 GEOLOCATION API
    //
    // References:
    // Geolocation API:
    // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
    // getCurrentPosition():
    // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
    // PositionError:
    // https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
    // ========================================================================
    getMyLocation() {
      this.locationStatus = 'Locating...';
      this.locationError = '';

      if (!navigator.geolocation) {
        this.locationError = 'Geolocation is not supported by your current browser.';
        this.locationStatus = '';
        return;
      }

      navigator.geolocation.getCurrentPosition(
        // Success Callback
        (position) => {
          this.userLocation = {
            latitude: position.coords.latitude.toFixed(5),
            longitude: position.coords.longitude.toFixed(5),
            accuracy: Math.round(position.coords.accuracy),
            timestamp: new Date(position.timestamp).toLocaleTimeString()
          };
          this.locationStatus = 'Location detected successfully!';
          this.locationError = '';
        },

        // Error Callback
        (error) => {
          this.locationStatus = '';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              this.locationError = 'Permission denied. Please allow location access in your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              this.locationError = 'Location information is currently unavailable.';
              break;
            case error.TIMEOUT:
              this.locationError = 'The request to get user location timed out.';
              break;
            default:
              this.locationError = 'An unknown error occurred while retrieving location.';
              break;
          }
        },

        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    },

    clearLocation() {
      this.userLocation = null;
      this.locationStatus = '';
      this.locationError = '';
    },

    // ========================================================================
    // DATE FORMATTING
    //
    // References:
    // Intl.DateTimeFormat:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
    // Date:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
    // ========================================================================
    formatDate(dateStr) {
      if (!dateStr) return 'N/A';
      try {
        const parts = String(dateStr).split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const dateObj = new Date(year, month, day);

          return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).format(dateObj);
        }
        return dateStr;
      } catch (e) {
        return dateStr;
      }
    },

    // ========================================================================
    // STRING CONVERSION
    //
    // Reference:
    // String.prototype.toUpperCase():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toUpperCase
    // ========================================================================
    toUpperCase(text) {
      if (!text) return '';
      return String(text).toUpperCase();
    },

    // ========================================================================
    // DYNAMIC BOOTSTRAP STATUS BADGES
    //
    // Reference:
    // Bootstrap badges:
    // https://getbootstrap.com/docs/5.3/components/badge/
    // ========================================================================
    getStatusBadgeClass(status) {
      switch (status) {
        case 'Admitted':
        case 'Confirmed':
          return 'badge bg-success';
        case 'Waiting':
        case 'Pending':
          return 'badge bg-warning text-dark';
        case 'Discharged':
          return 'badge bg-secondary';
        case 'Cancelled':
          return 'badge bg-danger';
        case 'Available':
          return 'badge bg-success';
        case 'Occupied':
          return 'badge bg-danger';
        default:
          return 'badge bg-info text-dark';
      }
    },

    // ========================================================================
    // BROWSER LOCALSTORAGE: SAVE AND RESTORE PREFERENCES
    //
    // References:
    // Window.localStorage:
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
    // JSON.stringify():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
    // JSON.parse():
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
    // DOM classList:
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
    // ========================================================================
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.applyTheme();
      localStorage.setItem('hospital_theme', this.theme);
    },

    applyTheme() {
      if (this.theme === 'dark') {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
    },

    savePreferences() {
      const prefs = {
        selectedBatch: this.selectedBatchForAllocation,
        lastDepartment: this.patientFilterDept
      };
      localStorage.setItem('hospital_preferences', JSON.stringify(prefs));
    },

    loadPreferences() {
      // 1. Theme preference
      const savedTheme = localStorage.getItem('hospital_theme');
      if (savedTheme) {
        this.theme = savedTheme;
        this.applyTheme();
      }

      // 2. Filter & batch preferences
      const savedPrefs = localStorage.getItem('hospital_preferences');
      if (savedPrefs) {
        try {
          const parsed = JSON.parse(savedPrefs);
          if (parsed.selectedBatch) {
            this.selectedBatchForAllocation = parsed.selectedBatch;
          }
          if (parsed.lastDepartment) {
            this.patientFilterDept = parsed.lastDepartment;
          }
        } catch (e) {
          console.warn('Could not parse stored preferences', e);
        }
      }
    }
  },

  // --------------------------------------------------------------------------
  // MOUNTED LIFECYCLE HOOK
  //
  // References:
  // Vue lifecycle hooks:
  // https://vuejs.org/guide/essentials/lifecycle.html
  // Vue mounted hook:
  // https://vuejs.org/api/options-lifecycle.html#mounted
  // --------------------------------------------------------------------------
  mounted() {
    // Set today's date on default form fields
    const today = new Date().toISOString().split('T')[0];
    this.patientForm.admission_date = today;
    this.appointmentForm.appointment_date = today;

    // Restore UI preferences from LocalStorage
    this.loadPreferences();

    // Fetch initial data from MySQL via Node/Express
    this.loadAllData();
  }
}).mount('#app');