import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getInfo from '@salesforce/apex/ULS_AppController.getInfo';
import getSummary from '@salesforce/apex/ULS_AppController.getSummary';
import getLicenses from '@salesforce/apex/ULS_AppController.getLicenses';
import getProfiles from '@salesforce/apex/ULS_AppController.getProfiles';
import getRecentActiveUsers from '@salesforce/apex/ULS_AppController.getRecentActiveUsers';
import getLoginTrends from '@salesforce/apex/ULS_AppController.getLoginTrends';

import { fmtDate, sortBy, containsAny, toCsv, buildSparkPoints } from 'c/ulsUtil';

const SORT_DIR_OPTIONS = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' }
];

export default class UlsDashboard extends LightningElement {
  @track info = { version: '0.0.0', sandbox: false };
  @track summary = {
    activeUsers: 0, inactiveUsers: 0, totalUsers: 0,
    profiles: 0, licenses: 0, loginTrendStatus: '', loginTrendMessage: ''
  };

  activeTab = 'overview';

  busy = false;
  busyLabel = 'Loading...';

  // Users
  @track userRows = [];
  userSearch = '';
  userSortKey = 'lastLoginDate';
  userSortDir = 'desc';

  // Licenses
  @track licenseRows = [];
  licenseSearch = '';
  licenseSortKey = 'pctUsed';
  licenseSortDir = 'desc';

  // Profiles
  @track profileRows = [];
  profileSearch = '';
  profileSortKey = 'activeUsers';
  profileSortDir = 'desc';

  // Logins
  @track loginRows = [];
  loginDays = 30;

  connectedCallback() {
    this.bootstrap();
  }

  async bootstrap() {
    await this.withBusy('Loading snapshot...', async () => {
      this.info = await getInfo();
      await this.refreshAll();
    });
  }

  get envLabel() { return this.info.sandbox ? 'SANDBOX' : 'PRODUCTION'; }
  get envPillClass() { return this.info.sandbox ? 'pill pillOk' : 'pill pillHigh'; }

  get isOverview() { return this.activeTab === 'overview'; }
  get isUsers() { return this.activeTab === 'users'; }
  get isLicenses() { return this.activeTab === 'licenses'; }
  get isProfiles() { return this.activeTab === 'profiles'; }
  get isLogins() { return this.activeTab === 'logins'; }

  tabClass(name) { return name === this.activeTab ? 'tab tabActive' : 'tab'; }
  get tabClassOverview() { return this.tabClass('overview'); }
  get tabClassUsers() { return this.tabClass('users'); }
  get tabClassLicenses() { return this.tabClass('licenses'); }
  get tabClassProfiles() { return this.tabClass('profiles'); }
  get tabClassLogins() { return this.tabClass('logins'); }

  goOverview = () => { this.activeTab = 'overview'; };
  goUsers = async () => { this.activeTab = 'users'; if (!this.userRows.length) await this.loadUsers(); };
  goLicenses = async () => { this.activeTab = 'licenses'; if (!this.licenseRows.length) await this.loadLicenses(); };
  goProfiles = async () => { this.activeTab = 'profiles'; if (!this.profileRows.length) await this.loadProfiles(); };
  goLogins = async () => { this.activeTab = 'logins'; if (!this.loginRows.length) await this.loadLogins(30); };

  get loginTrendPillClass() {
    return this.summary.loginTrendStatus === 'OK' ? 'pill pillOk' : 'pill pillWarn';
  }

  get sortDirOptions() { return SORT_DIR_OPTIONS; }

  get userSortOptions() {
    return [
      { label: 'Last login', value: 'lastLoginDate' },
      { label: 'Name', value: 'name' },
      { label: 'Profile', value: 'profileName' },
      { label: 'Type', value: 'userType' }
    ];
  }
  get licenseSortOptions() {
    return [
      { label: '% used', value: 'pctUsed' },
      { label: 'Used', value: 'used' },
      { label: 'Total', value: 'total' },
      { label: 'Name', value: 'name' }
    ];
  }
  get profileSortOptions() {
    return [
      { label: 'Active users', value: 'activeUsers' },
      { label: 'Profile', value: 'name' }
    ];
  }

  // Derived sets
  get userRowsFiltered() {
    let out = (this.userRows || []).map(u => ({ ...u, lastLoginFmt: fmtDate(u.lastLoginDate) }));
    out = out.filter(u => containsAny(u, ['name','username','profileName','userType','email'], this.userSearch));
    out = sortBy(out, this.userSortKey, this.userSortDir);
    return out;
  }

  get licenseRowsFiltered() {
    let out = (this.licenseRows || []).map(l => ({
      ...l,
      pctUsed: Number(l.pctUsed || 0).toFixed(1),
      pctClass: Number(l.pctUsed || 0) >= 90 ? 'pill pillHigh' : (Number(l.pctUsed || 0) >= 75 ? 'pill pillWarn' : 'pill pillOk')
    }));
    out = out.filter(l => containsAny(l, ['name'], this.licenseSearch));
    out = sortBy(out, this.licenseSortKey, this.licenseSortDir);
    return out;
  }

  get profileRowsFiltered() {
    let out = (this.profileRows || []).map(p => ({ ...p }));
    out = out.filter(p => containsAny(p, ['name'], this.profileSearch));
    out = sortBy(out, this.profileSortKey, this.profileSortDir);
    return out;
  }

  get topLicense() {
    const arr = this.licenseRows || [];
    if (!arr.length) return null;
    return arr.reduce((m, r) => (Number(r.pctUsed || 0) > Number(m?.pctUsed || -1) ? r : m), null);
  }

  get loginModeLabel() {
    return `LAST ${this.loginDays} DAYS`;
  }

  get loginSparkPoints() {
    if (!this.loginRows || !this.loginRows.length) return '';
    const vals = this.loginRows.map(r => r.logins);
    return buildSparkPoints(vals);
  }

  get loginSparkLabel() {
    if (!this.loginRows || !this.loginRows.length) return '—';
    const total = this.loginRows.reduce((a, b) => a + (Number(b.logins) || 0), 0);
    return `${total} logins total`;
  }

  get busyOrNoUsers() { return this.busy || !this.userRowsFiltered.length; }
  get busyOrNoLicenses() { return this.busy || !this.licenseRowsFiltered.length; }
  get busyOrNoProfiles() { return this.busy || !this.profileRowsFiltered.length; }
  get busyOrNoLogins() { return this.busy || !this.loginRows.length; }

  // UI events
  onUserSearch = (e) => { this.userSearch = e.target.value; };
  onLicenseSearch = (e) => { this.licenseSearch = e.target.value; };
  onProfileSearch = (e) => { this.profileSearch = e.target.value; };

  onUserSortKey = (e) => { this.userSortKey = e.detail.value; };
  onUserSortDir = (e) => { this.userSortDir = e.detail.value; };
  onLicenseSortKey = (e) => { this.licenseSortKey = e.detail.value; };
  onLicenseSortDir = (e) => { this.licenseSortDir = e.detail.value; };
  onProfileSortKey = (e) => { this.profileSortKey = e.detail.value; };
  onProfileSortDir = (e) => { this.profileSortDir = e.detail.value; };

  // Data loading
  async refreshAll() {
    await this.withBusy('Refreshing...', async () => {
      this.summary = await getSummary();
      await this.loadLicenses();
      await this.loadProfiles();
      await this.loadUsers();
      await this.loadLogins(30);
    });
  }

  async loadUsers() {
    this.userRows = await getRecentActiveUsers({ limitSize: 80 });
  }

  async loadLicenses() {
    this.licenseRows = await getLicenses();
  }

  async loadProfiles() {
    this.profileRows = await getProfiles();
  }

  async loadLogins(days) {
    this.loginDays = days;
    const rows = await getLoginTrends({ days });
    this.loginRows = (rows || []).map(r => ({
      day: r.day,
      logins: r.logins || 0,
      uniqueUsers: r.uniqueUsers || 0
    }));
  }

  load7 = async () => { await this.withBusy('Loading 7-day trend...', async () => this.loadLogins(7)); };
  load30 = async () => { await this.withBusy('Loading 30-day trend...', async () => this.loadLogins(30)); };

  // Exports
  exportUsers() {
    const rows = this.userRowsFiltered;
    const csv = toCsv(
      ['Name','Username','Profile','Type','LastLogin'],
      rows,
      r => [r.name, r.username, r.profileName, r.userType, r.lastLoginFmt]
    );
    this.download(csv, 'users-snapshot.csv');
  }

  exportLicenses() {
    const rows = this.licenseRowsFiltered;
    const csv = toCsv(
      ['License','Total','Used','Remaining','PercentUsed'],
      rows,
      r => [r.name, r.total, r.used, r.remaining, r.pctUsed]
    );
    this.download(csv, 'licenses-snapshot.csv');
  }

  exportProfiles() {
    const rows = this.profileRowsFiltered;
    const csv = toCsv(
      ['Profile','ActiveUsers'],
      rows,
      r => [r.name, r.activeUsers]
    );
    this.download(csv, 'profiles-snapshot.csv');
  }

  exportLogins() {
    const rows = this.loginRows || [];
    const csv = toCsv(
      ['Day','Logins','UniqueUsers'],
      rows,
      r => [r.day, r.logins, r.uniqueUsers]
    );
    this.download(csv, `login-trend-${this.loginDays}d.csv`);
  }

  download(csv, filename) {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast('Exported', filename, 'success');
    } catch (e) {
      this.toast('Export failed', this.humanError(e), 'error');
    }
  }

  // helpers
  async withBusy(label, fn) {
    this.busy = true;
    this.busyLabel = label || 'Working...';
    try { return await fn(); }
    catch (e) { this.toast('Error', this.humanError(e), 'error'); throw e; }
    finally { this.busy = false; this.busyLabel = ''; }
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  humanError(e) {
    try {
      if (e?.body?.message) return e.body.message;
      if (Array.isArray(e?.body) && e.body[0]?.message) return e.body[0].message;
      if (e?.message) return e.message;
      return JSON.stringify(e);
    } catch { return String(e); }
  }
}
