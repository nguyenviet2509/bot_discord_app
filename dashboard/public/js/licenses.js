// Alpine.js component cho tab Licenses.
// Quan ly license keys: list, create, revoke, reset-machine, edit note, view events.

document.addEventListener('alpine:init', () => {
  Alpine.data('licensesSection', () => ({
    licenses: [],
    loading: false,
    toast: null,
    _toastTimer: null,

    // Create modal
    showCreate: false,
    creating: false,
    createForm: { user_label: '', expires_days: '', note: '' },
    newToken: null, // plaintext token hien 1 lan sau khi tao

    // Events drawer
    showEvents: false,
    eventsLicense: null,
    events: [],
    eventsLoading: false,

    // Edit note modal
    showEdit: false,
    editForm: { id: null, user_label: '', expires_days: '', note: '' },
    saving: false,

    // Pagination
    page: 1,
    pageSize: 10,

    // Bulk selection: tap ID
    selectedIds: [],

    get totalPages() {
      return Math.max(1, Math.ceil((this.licenses?.length || 0) / this.pageSize))
    },

    get pagedLicenses() {
      const start = (this.page - 1) * this.pageSize
      return this.licenses.slice(start, start + this.pageSize)
    },

    get pageStart() {
      if (!this.licenses.length) return 0
      return (this.page - 1) * this.pageSize + 1
    },

    get pageEnd() {
      return Math.min(this.page * this.pageSize, this.licenses.length)
    },

    goPage(p) {
      const tp = this.totalPages
      if (p < 1) p = 1
      if (p > tp) p = tp
      this.page = p
    },

    isSelected(id) {
      return this.selectedIds.includes(id)
    },

    toggleSelect(id) {
      const i = this.selectedIds.indexOf(id)
      if (i >= 0) this.selectedIds.splice(i, 1)
      else this.selectedIds.push(id)
    },

    get allOnPageSelected() {
      const ids = this.pagedLicenses.map((l) => l.id)
      return ids.length > 0 && ids.every((id) => this.selectedIds.includes(id))
    },

    toggleSelectPage() {
      const ids = this.pagedLicenses.map((l) => l.id)
      if (this.allOnPageSelected) {
        this.selectedIds = this.selectedIds.filter((id) => !ids.includes(id))
      } else {
        const set = new Set(this.selectedIds)
        ids.forEach((id) => set.add(id))
        this.selectedIds = Array.from(set)
      }
    },

    clearSelection() {
      this.selectedIds = []
    },

    async deleteOne(lic) {
      if (!confirm(`Xoa han license "${lic.user_label || lic.token}"?\nHanh dong nay khong the hoan tac (du lieu va event log se mat).`)) return
      const data = await api('DELETE', `/admin/licenses/${lic.id}`)
      if (data?.ok) {
        this.selectedIds = this.selectedIds.filter((id) => id !== lic.id)
        this.showToast('Da xoa license')
        await this.load()
        if (this.page > this.totalPages) this.page = this.totalPages
      } else {
        this.showToast(data?.error || 'Loi xoa', 'red')
      }
    },

    async deleteSelected() {
      if (this.selectedIds.length === 0) return
      if (!confirm(`Xoa han ${this.selectedIds.length} license da chon?\nHanh dong nay khong the hoan tac.`)) return
      const data = await api('POST', '/admin/licenses/bulk-delete', { ids: this.selectedIds })
      if (data?.ok) {
        this.showToast(`Da xoa ${data.deleted} license`)
        this.selectedIds = []
        await this.load()
        if (this.page > this.totalPages) this.page = this.totalPages
      } else {
        this.showToast(data?.error || 'Loi xoa hang loat', 'red')
      }
    },

    async init() {
      await this.load()
    },

    async load() {
      this.loading = true
      try {
        const data = await api('GET', '/admin/licenses')
        this.licenses = data || []
      } catch (e) {
        this.showToast('Loi tai danh sach license', 'red')
      } finally {
        this.loading = false
      }
    },

    showToast(msg, color = 'green') {
      clearTimeout(this._toastTimer)
      this.toast = { msg, color }
      this._toastTimer = setTimeout(() => { this.toast = null }, 3500)
    },

    formatDate(unix) {
      if (!unix) return '—'
      return new Date(unix * 1000).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    },

    formatDateTime(unix) {
      if (!unix) return '—'
      return new Date(unix * 1000).toLocaleString('vi-VN')
    },

    statusBadge(lic) {
      if (lic.revoked) return { label: 'Revoked', cls: 'bg-red-100 text-red-700' }
      if (lic.expires_at && Math.floor(Date.now() / 1000) > lic.expires_at) {
        return { label: 'Expired', cls: 'bg-orange-100 text-orange-700' }
      }
      if (lic.machine_id) return { label: 'Active', cls: 'bg-green-100 text-green-700' }
      return { label: 'Unused', cls: 'bg-slate-100 text-slate-600' }
    },

    openCreate() {
      this.createForm = { user_label: '', expires_days: '365', note: '' }
      this.newToken = null
      this.showCreate = true
    },

    async submitCreate() {
      if (this.creating) return
      this.creating = true
      try {
        const body = {
          user_label: this.createForm.user_label.trim() || null,
          note: this.createForm.note.trim() || null,
        }
        if (this.createForm.expires_days) {
          body.expires_days = parseInt(this.createForm.expires_days, 10)
        }
        const data = await api('POST', '/admin/licenses', body)
        if (data?.token) {
          this.newToken = data.token
          await this.load()
        } else {
          this.showToast(data?.error || 'Loi tao license', 'red')
        }
      } catch (e) {
        this.showToast('Loi ket noi', 'red')
      } finally {
        this.creating = false
      }
    },

    copyToken() {
      if (!this.newToken) return
      navigator.clipboard.writeText(this.newToken).then(() => {
        this.showToast('Da copy token vao clipboard')
      }).catch(() => {
        this.showToast('Copy that bai — copy thu cong', 'red')
      })
    },

    closeCreate() {
      this.showCreate = false
      this.newToken = null
    },

    async revoke(lic) {
      if (!confirm(`Revoke license cua "${lic.user_label || lic.token}"?\nHanh dong nay khong the hoan tac.`)) return
      const data = await api('POST', `/admin/licenses/${lic.id}/revoke`)
      if (data?.ok) {
        this.showToast('Da revoke license')
        await this.load()
      } else {
        this.showToast(data?.error || 'Loi revoke', 'red')
      }
    },

    async resetMachine(lic) {
      if (!confirm(`Reset machine binding cho license "${lic.user_label || lic.token}"?\nUser se co the activate tren may moi.`)) return
      const data = await api('POST', `/admin/licenses/${lic.id}/reset-machine`)
      if (data?.ok) {
        this.showToast('Da reset machine binding')
        await this.load()
      } else {
        this.showToast(data?.error || 'Loi reset machine', 'red')
      }
    },

    openEdit(lic) {
      this.editForm = {
        id: lic.id,
        user_label: lic.user_label || '',
        expires_days: '',
        note: lic.note || '',
      }
      this.showEdit = true
    },

    async submitEdit() {
      if (this.saving) return
      this.saving = true
      try {
        const body = {
          user_label: this.editForm.user_label.trim() || null,
          note: this.editForm.note.trim() || null,
        }
        if (this.editForm.expires_days) {
          body.expires_days = parseInt(this.editForm.expires_days, 10)
        }
        const data = await api('PATCH', `/admin/licenses/${this.editForm.id}`, body)
        if (data?.id) {
          this.showToast('Da cap nhat')
          this.showEdit = false
          await this.load()
        } else {
          this.showToast(data?.error || 'Loi cap nhat', 'red')
        }
      } catch (e) {
        this.showToast('Loi ket noi', 'red')
      } finally {
        this.saving = false
      }
    },

    async viewEvents(lic) {
      this.eventsLicense = lic
      this.showEvents = true
      this.eventsLoading = true
      this.events = []
      try {
        const data = await api('GET', `/admin/licenses/${lic.id}/events`)
        this.events = Array.isArray(data) ? data : []
      } catch (e) {
        this.showToast('Loi tai events', 'red')
      } finally {
        this.eventsLoading = false
      }
    },

    eventTypeLabel(type) {
      const map = {
        activate: 'Activate',
        activate_reject: 'Activate Reject',
        verify: 'Verify',
        verify_reject: 'Verify Reject',
        revoked: 'Revoked',
        reset_machine: 'Reset Machine',
      }
      return map[type] || type
    },

    eventTypeCls(type) {
      if (type === 'activate') return 'bg-green-100 text-green-700'
      if (type === 'verify') return 'bg-blue-100 text-blue-700'
      if (type.includes('reject')) return 'bg-red-100 text-red-700'
      if (type === 'revoked') return 'bg-red-200 text-red-800'
      return 'bg-slate-100 text-slate-600'
    },
  }))
})
