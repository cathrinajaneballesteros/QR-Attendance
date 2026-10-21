import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import Modal from '../components/Modal';
import { 
  Users, 
  UserPlus, 
  Search, 
  QrCode, 
  Edit, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Printer,
  ListPlus,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  Camera
} from 'lucide-react';
import StudentFaceScannerModal from '../components/StudentFaceScannerModal';
import StudentQrModal from '../components/StudentQrModal';
import { showConfirm } from '../utils/dialog';
import {
  PageTitle,
  Card,
  SectionCard,
  DataTable,
  StatusBadge,
  EmptyState,
  Button
} from '../components/ui';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('ALL');
  const [enrollFilter, setEnrollFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [faceModalStudent, setFaceModalStudent] = useState(null);
  const [selectedQrStudent, setSelectedQrStudent] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    sex: 'M',
    lrn: '',
    student_phone: '',
    guardian_name: '',
    guardian_contact: '',
    email: '',
    is_enrolled: 1,
    enrollment_status: 'officially_enrolled'
  });

  // Batch Roster state (Requirement 10: Teacher sets number and name of students)
  const [batchData, setBatchData] = useState({
    targetCount: 25,
    namesText: '',
    defaultSex: 'M',
    markOfficiallyEnrolled: true,
    replaceExisting: false
  });
  const [batchLoading, setBatchLoading] = useState(false);

  // Excel Import state (specifically designed for DepEd SF2 e.g. add learner.xls sheet MARCH)
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importSheetName, setImportSheetName] = useState('MARCH');
  const [importAvailableSheets, setImportAvailableSheets] = useState([]);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [importReplaceExisting, setImportReplaceExisting] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);

  const [alert, setAlert] = useState(null);
  const location = useLocation();

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/students');
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // Listen for ?import=true in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('import') === 'true' || params.get('import') === 'excel') {
      setIsImportOpen(true);
    }
  }, [location.search]);

  const resetImportState = () => {
    setImportFile(null);
    setImportSheetName('MARCH');
    setImportAvailableSheets([]);
    setImportPreviewData(null);
    setImportReplaceExisting(students.length === 0);
    setImportParsing(false);
    setImportLoading(false);
    setImportError(null);
  };

  const handleOpenImport = () => {
    resetImportState();
    setImportReplaceExisting(students.length === 0);
    setIsImportOpen(true);
  };

  const parseExcelFile = async (file, sheet = null) => {
    if (!file) return;
    setImportParsing(true);
    setImportError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      if (sheet) {
        formDataUpload.append('sheetName', sheet);
      }
      formDataUpload.append('preview', 'true');

      const response = await apiFetch('/api/students/import-excel?preview=true', {
        method: 'POST',
        body: formDataUpload
      });

      const data = await response.json();
      if (response.ok) {
        setImportPreviewData(data);
        if (data.sheetName) setImportSheetName(data.sheetName);
        if (data.availableSheets) setImportAvailableSheets(data.availableSheets);
      } else {
        setImportError(data.error || 'Failed to parse Excel file.');
        setImportPreviewData(null);
      }
    } catch (err) {
      console.error('Error parsing excel:', err);
      setImportError('Failed to upload and parse Excel file.');
      setImportPreviewData(null);
    } finally {
      setImportParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setImportFile(file);
      parseExcelFile(file, importSheetName || null);
    }
  };

  const handleSheetChange = (newSheet) => {
    setImportSheetName(newSheet);
    if (importFile) {
      parseExcelFile(importFile, newSheet);
    }
  };

  const handleExecuteImport = async () => {
    if (!importFile) {
      setImportError('Please select an Excel file first.');
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', importFile);
      if (importSheetName) {
        formDataUpload.append('sheetName', importSheetName);
      }
      formDataUpload.append('replaceExisting', importReplaceExisting ? 'true' : 'false');

      const response = await apiFetch('/api/students/import-excel', {
        method: 'POST',
        body: formDataUpload
      });

      const data = await response.json();
      if (response.ok) {
        showAlert(data.message || `Successfully imported ${data.count} learners!`);
        setIsImportOpen(false);
        resetImportState();
        loadStudents();
      } else {
        setImportError(data.error || 'Failed to import learners from Excel.');
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Network error importing learners.');
    } finally {
      setImportLoading(false);
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      showAlert('Student full name is required.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (response.ok) {
        showAlert(`Student "${formData.full_name}" added successfully!`);
        setIsAddOpen(false);
        setFormData({
          full_name: '',
          sex: 'M',
          lrn: '',
          student_phone: '',
          guardian_name: '',
          guardian_contact: '',
          email: '',
          is_enrolled: 1,
          enrollment_status: 'officially_enrolled'
        });
        loadStudents();
      } else {
        showAlert(data.error || 'Failed to add student.', 'error');
      }
    } catch (err) {
      showAlert('Network error adding student.', 'error');
    }
  };

  const openEditModal = (student) => {
    setEditStudent(student);
    setFormData({
      full_name: student.full_name || '',
      sex: student.sex || 'M',
      lrn: student.lrn || '',
      student_phone: student.student_phone || '',
      guardian_name: student.guardian_name || '',
      guardian_contact: student.guardian_contact || '',
      email: student.email || '',
      is_enrolled: student.is_enrolled !== 0 ? 1 : 0,
      enrollment_status: student.enrollment_status || 'officially_enrolled'
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editStudent) return;

    try {
      const response = await apiFetch(`/api/students/${editStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showAlert(`Student "${formData.full_name}" updated successfully!`);
        setIsEditOpen(false);
        setEditStudent(null);
        loadStudents();
      } else {
        const data = await response.json();
        showAlert(data.error || 'Failed to update student.', 'error');
      }
    } catch (err) {
      showAlert('Network error updating student.', 'error');
    }
  };

  const isStudentEnrolled = (s) => {
    if (!s) return false;
    if (s.is_enrolled === 0 || s.is_enrolled === '0' || s.is_enrolled === false) return false;
    if (s.enrollment_status === 'not_enrolled' || s.enrollment_status === 'dropped') return false;
    return true;
  };

  // Quick toggle enrollment status
  const handleToggleEnrollment = async (student) => {
    const currentlyEnrolled = isStudentEnrolled(student);
    const newStatus = currentlyEnrolled ? 0 : 1;
    const newStatusText = newStatus ? 'officially_enrolled' : 'not_enrolled';

    try {
      const res = await apiFetch(`/api/students/${student.id}/enrollment`, {
        method: 'PATCH',
        body: JSON.stringify({ is_enrolled: newStatus })
      });
      if (res.ok) {
        showAlert(`${student.full_name}: ${newStatus ? 'Officially Enrolled (Can record attendance)' : 'Not Enrolled (Attendance blocked)'}`);
        loadStudents();
        return;
      }

      // Fallback via PUT
      const putRes = await apiFetch(`/api/students/${student.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...student,
          is_enrolled: newStatus,
          enrollment_status: newStatusText
        })
      });
      if (putRes.ok) {
        showAlert(`${student.full_name}: ${newStatus ? 'Officially Enrolled' : 'Not Enrolled'}`);
        loadStudents();
      }
    } catch (e) {
      showAlert('Failed to update enrollment status', 'error');
    }
  };

  const handleClearFace = async (student) => {
    const confirmed = await showConfirm({
      title: 'Remove Facial Profile?',
      text: `Are you sure you want to remove the facial biometric profile for ${student.full_name}?`,
      confirmButtonText: 'Yes, Remove Profile',
      isDanger: true
    });
    if (!confirmed) {
      return;
    }
    try {
      const res = await apiFetch(`/api/students/${student.id}/face`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || `Facial profile cleared for ${student.full_name}`);
        loadStudents();
      } else {
        showAlert(data.error || 'Failed to clear facial profile', 'error');
      }
    } catch (e) {
      showAlert('Network error clearing facial profile', 'error');
    }
  };
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const lines = batchData.namesText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (!lines.length) {
      showAlert('Please enter at least one student name.', 'error');
      return;
    }

    setBatchLoading(true);

    const studentsPayload = lines.map(line => {
      // Support comma or space separated format
      let name = line;
      let sex = batchData.defaultSex;
      // If line ends with (M) or (F) or has gender tag
      if (/\((M|F)\)$/i.test(line)) {
        const match = line.match(/\((M|F)\)$/i);
        sex = match[1].toUpperCase();
        name = line.replace(/\((M|F)\)$/i, '').trim();
      }

      return {
        full_name: name,
        sex: sex,
        is_enrolled: batchData.markOfficiallyEnrolled ? 1 : 0,
        enrollment_status: batchData.markOfficiallyEnrolled ? 'officially_enrolled' : 'not_enrolled'
      };
    });

    try {
      const response = await apiFetch('/api/students/batch-setup', {
        method: 'POST',
        body: JSON.stringify({
          students: studentsPayload,
          clearExisting: batchData.replaceExisting
        })
      });

      const data = await response.json();
      if (response.ok) {
        showAlert(data.message || 'Class roster created successfully!');
        setIsBatchOpen(false);
        setBatchData({
          targetCount: 25,
          namesText: '',
          defaultSex: 'M',
          markOfficiallyEnrolled: true,
          replaceExisting: false
        });
        loadStudents();
      } else {
        showAlert(data.error || 'Failed to set up class roster.', 'error');
      }
    } catch (err) {
      showAlert('Network error setting up roster.', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = await showConfirm({
      title: 'Delete Student Record?',
      text: `Are you sure you want to delete ${name}? This cannot be undone.`,
      confirmButtonText: 'Yes, Delete',
      isDanger: true
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/api/students/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showAlert(`Student "${name}" deleted.`);
        loadStudents();
      } else {
        const data = await response.json();
        showAlert(data.error || 'Failed to delete student.', 'error');
      }
    } catch (err) {
      showAlert('Network error deleting student.', 'error');
    }
  };

  const maleCount = students.filter(s => s.sex === 'M').length;
  const femaleCount = students.filter(s => s.sex === 'F').length;
  const enrolledCount = students.filter(s => isStudentEnrolled(s)).length;
  const notEnrolledCount = students.length - enrolledCount;

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.lrn?.toLowerCase().includes(search.toLowerCase()) ||
      s.qr_code?.toLowerCase().includes(search.toLowerCase());
    const matchesSex = sexFilter === 'ALL' || s.sex === sexFilter;
    const isOfficiallyEnrolled = isStudentEnrolled(s);
    const matchesEnroll = 
      enrollFilter === 'ALL' || 
      (enrollFilter === 'enrolled' && isOfficiallyEnrolled) ||
      (enrollFilter === 'not_enrolled' && !isOfficiallyEnrolled);

    return matchesSearch && matchesSex && matchesEnroll;
  });

  return (
    <div className="sres-students-page">
      {/* 1. Page Title with Counts Tag and Quick Actions */}
      <PageTitle
        title="Class Roster"
        emoji="👥"
        tag={`Total: ${students.length} Learners (${maleCount} Male, ${femaleCount} Female) • ${enrolledCount} Officially Enrolled`}
        icon={Users}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              icon={FileSpreadsheet}
              onClick={handleOpenImport}
              title="Import learners from DepEd SF2 Excel template (.xls / .xlsx)"
            >
              Import Excel (.xls)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={ListPlus}
              onClick={() => setIsBatchOpen(true)}
            >
              Set Class Roster ({students.length})
            </Button>

            <Link to="/teacher/print-qr" className="sres-btn sres-btn-secondary sres-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={14} strokeWidth={1.8} />
              <span>Print All QRs</span>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              icon={UserPlus}
              onClick={() => setIsAddOpen(true)}
            >
              Add Learner
            </Button>
          </div>
        }
      />

      {alert && (
        <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '18px' }}>
          {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Fresh Teacher Account Onboarding Callout Banner */}
      {students.length === 0 && !loading && (
        <Card
          style={{
            background: 'linear-gradient(135deg, #FFF5F8 0%, #FFFFFF 100%)',
            border: '1.5px dashed var(--border-pink)',
            textAlign: 'center',
            marginBottom: '22px'
          }}
          padding="28px 24px"
        >
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <FileSpreadsheet size={26} strokeWidth={1.8} />
          </div>
          <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '8px' }}>
            Fresh Teacher Account: No Learners in Your Class Yet
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 18px auto', lineHeight: 1.5 }}>
            Each teacher manages their own isolated student records. To start recording attendance, import your official learner list directly from your Excel file (e.g. <code>add learner.xls</code> on sheet <code>MARCH</code>) or add learners individually.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              variant="primary"
              icon={FileSpreadsheet}
              onClick={handleOpenImport}
            >
              Import Learners from Excel (.xls / .xlsx)
            </Button>
            <Button 
              variant="secondary"
              icon={ListPlus}
              onClick={() => setIsBatchOpen(true)}
            >
              Paste Names List
            </Button>
            <Button 
              variant="secondary"
              icon={UserPlus}
              onClick={() => setIsAddOpen(true)}
            >
              Add Single Learner
            </Button>
          </div>
        </Card>
      )}

      {/* Main Roster Card */}
      <SectionCard
        title="Learners Directory"
        subtitle={`Showing ${filteredStudents.length} of ${students.length} students`}
        icon={Users}
      >
        {/* Search and Filters row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ 
                paddingLeft: '38px',
                borderRadius: '10px',
                borderColor: 'var(--border-pink)',
                background: '#FFFFFF'
              }}
              placeholder="Search by learner name, LRN, or QR code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} strokeWidth={1.8} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button 
              type="button"
              className={`sres-btn sres-btn-sm ${sexFilter === 'ALL' ? 'sres-btn-primary' : 'sres-btn-secondary'}`}
              onClick={() => setSexFilter('ALL')}
            >
              All ({students.length})
            </button>
            <button 
              type="button"
              className={`sres-btn sres-btn-sm ${sexFilter === 'M' ? 'sres-btn-primary' : 'sres-btn-secondary'}`}
              onClick={() => setSexFilter('M')}
            >
              Male ({maleCount})
            </button>
            <button 
              type="button"
              className={`sres-btn sres-btn-sm ${sexFilter === 'F' ? 'sres-btn-primary' : 'sres-btn-secondary'}`}
              onClick={() => setSexFilter('F')}
            >
              Female ({femaleCount})
            </button>

            {/* Requirement 11 filter */}
            <button 
              type="button"
              className={`sres-btn sres-btn-sm ${enrollFilter === 'enrolled' ? 'sres-btn-primary' : 'sres-btn-secondary'}`}
              onClick={() => setEnrollFilter(enrollFilter === 'enrolled' ? 'ALL' : 'enrolled')}
              title="Show only officially enrolled students eligible for attendance"
            >
              Enrolled ({enrolledCount})
            </button>
            {notEnrolledCount > 0 && (
              <button 
                type="button"
                className={`sres-btn sres-btn-sm ${enrollFilter === 'not_enrolled' ? 'sres-btn-danger' : 'sres-btn-secondary'}`}
                onClick={() => setEnrollFilter(enrollFilter === 'not_enrolled' ? 'ALL' : 'not_enrolled')}
                title="Show learners blocked from attendance"
              >
                Blocked ({notEnrolledCount})
              </button>
            )}
          </div>
        </div>

        {/* Students Table */}
        <DataTable
          columns={[
            { label: 'No.', width: '45px' },
            { label: 'Learner Name' },
            { label: 'LRN', width: '130px' },
            { label: 'Sex', width: '70px' },
            { label: 'QR Code ID', width: '140px' },
            { label: 'Enrollment Status', width: '160px' },
            { label: 'Face ID', width: '135px', align: 'center' },
            { label: 'Guardian Contact' },
            { label: 'Actions', width: '110px', align: 'center' }
          ]}
        >
          {filteredStudents.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {search ? 'No matching students found.' : 'No students found in the database.'}
              </td>
            </tr>
          ) : (
            filteredStudents.map((s, index) => {
              const isEnrolled = isStudentEnrolled(s);
              return (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        {s.full_name}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-heading)' }}>
                    {s.lrn || '—'}
                  </td>
                  <td>
                    <StatusBadge
                      variant={s.sex === 'M' ? 'neutral' : 'pink'}
                      label={s.sex === 'M' ? 'Male' : 'Female'}
                    />
                  </td>
                  <td>
                    {s.qr_code ? (
                      <button
                        type="button"
                        onClick={() => setSelectedQrStudent(s)}
                        title={`View and download QR Code badge for ${s.full_name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.76rem',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          color: 'var(--primary)',
                          border: '1px solid var(--border-pink)',
                          background: 'var(--primary-light)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <QrCode size={13} strokeWidth={1.8} />
                        <span>View QR</span>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {/* Toggle enrollment status */}
                    <button
                      type="button"
                      onClick={() => handleToggleEnrollment(s)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left'
                      }}
                      title="Click to toggle enrollment eligibility for attendance"
                    >
                      {isEnrolled ? (
                        <StatusBadge
                          variant="success"
                          icon={ShieldCheck}
                          label="Enrolled"
                        />
                      ) : (
                        <StatusBadge
                          variant="danger"
                          icon={ShieldAlert}
                          label="Blocked"
                        />
                      )}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {s.has_face_profile ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setFaceModalStudent(s)}
                          className="sres-btn sres-btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            background: '#ECFDF5',
                            color: '#10B981',
                            border: '1px solid #A7F3D0',
                            borderRadius: '12px'
                          }}
                          title="Face biometric enrolled. Click to re-scan/update."
                        >
                          <ShieldCheck size={12} strokeWidth={2} />
                          <span>Enrolled</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearFace(s)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Clear face biometric data"
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFaceModalStudent(s)}
                        className="sres-btn sres-btn-secondary sres-btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '12px'
                        }}
                        title="Register face biometric for this student"
                      >
                        <Camera size={12} strokeWidth={1.8} />
                        <span>Register Face</span>
                      </button>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {s.guardian_contact || s.student_phone || 'No Contact'}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="sres-btn sres-btn-secondary sres-btn-sm"
                        style={{ padding: '6px 8px' }}
                        title="Edit Student"
                        onClick={() => openEditModal(s)}
                      >
                        <Edit size={13} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="sres-btn sres-btn-danger sres-btn-sm"
                        style={{ padding: '6px 8px' }}
                        title="Delete Student"
                        onClick={() => handleDelete(s.id, s.full_name)}
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </DataTable>
      </SectionCard>

      {/* Requirement 10: Setup Class Roster & Student Names Modal */}
      <Modal 
        isOpen={isBatchOpen} 
        onClose={() => setIsBatchOpen(false)} 
        title="Set Class Roster & Student Names (Batch Setup)"
      >
        <form onSubmit={handleBatchSubmit}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Set the number and names of learners for your class. You can paste your official list of names (one learner per line).
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Class Target Size / Number of Learners</label>
              <input
                type="number"
                min="1"
                max="100"
                className="form-input"
                value={batchData.targetCount}
                onChange={(e) => setBatchData({ ...batchData, targetCount: parseInt(e.target.value, 10) || 1 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Sex for Unspecified Entries</label>
              <select
                className="form-select"
                value={batchData.defaultSex}
                onChange={(e) => setBatchData({ ...batchData, defaultSex: e.target.value })}
              >
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Enter or Paste Student Names (One per line) *
            </label>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Tip: Append <code>(M)</code> or <code>(F)</code> at end of line to specify sex (e.g. <code>CRUZ, JUAN (M)</code> or <code>SANTOS, MARIA (F)</code>)
            </div>
            <textarea
              className="form-input"
              rows={8}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
              placeholder={`CRUZ, JUAN M. (M)\nSANTOS, MARIA L. (F)\nDELA PENA, ALDRIN G. (M)`}
              value={batchData.namesText}
              onChange={(e) => setBatchData({ ...batchData, namesText: e.target.value })}
              required
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>
              Lines parsed: {batchData.namesText.split('\n').filter(l => l.trim().length > 0).length} learners entered
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={batchData.markOfficiallyEnrolled}
                onChange={(e) => setBatchData({ ...batchData, markOfficiallyEnrolled: e.target.checked })}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>Mark all added learners as <strong>Officially Enrolled</strong> (Eligible to scan QR attendance)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#b91c1c' }}>
              <input
                type="checkbox"
                checked={batchData.replaceExisting}
                onChange={(e) => setBatchData({ ...batchData, replaceExisting: e.target.checked })}
                style={{ accentColor: '#b91c1c' }}
              />
              <span>Replace existing roster (Warning: will delete current learner list first)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsBatchOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={batchLoading}>
              {batchLoading ? 'Saving Roster...' : 'Save Roster & Generate QR Codes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Student Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Learner / Transferee">
        <form onSubmit={handleAddSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name (LAST, FIRST, MIDDLE) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. DELA CRUZ, JUAN M."
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Sex</label>
              <select
                className="form-select"
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">LRN (Learner Reference No.)</label>
              <input
                type="text"
                className="form-input"
                placeholder="12-digit LRN"
                value={formData.lrn}
                onChange={(e) => setFormData({ ...formData, lrn: e.target.value })}
              />
            </div>
          </div>

          {/* Requirement 11: Official Enrollment toggle */}
          <div className="form-group">
            <label className="form-label">Enrollment Status</label>
            <select
              className="form-select"
              value={formData.enrollment_status}
              onChange={(e) => setFormData({
                ...formData,
                enrollment_status: e.target.value,
                is_enrolled: e.target.value === 'officially_enrolled' ? 1 : 0
              })}
            >
              <option value="officially_enrolled">Officially Enrolled (Can record attendance)</option>
              <option value="not_enrolled">Not Officially Enrolled / Dropped (Attendance blocked)</option>
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Guardian Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Parent/Guardian Full Name"
                value={formData.guardian_name}
                onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Guardian Phone (SMS)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 09171234567"
                value={formData.guardian_contact}
                onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Learner
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Learner Information">
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Sex</label>
              <select
                className="form-select"
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">LRN</label>
              <input
                type="text"
                className="form-input"
                value={formData.lrn}
                onChange={(e) => setFormData({ ...formData, lrn: e.target.value })}
              />
            </div>
          </div>

          {/* Requirement 11: Official Enrollment toggle */}
          <div className="form-group">
            <label className="form-label">Enrollment Status</label>
            <select
              className="form-select"
              value={formData.enrollment_status}
              onChange={(e) => setFormData({
                ...formData,
                enrollment_status: e.target.value,
                is_enrolled: e.target.value === 'officially_enrolled' ? 1 : 0
              })}
            >
              <option value="officially_enrolled">Officially Enrolled (Can record attendance)</option>
              <option value="not_enrolled">Not Officially Enrolled / Dropped (Attendance blocked)</option>
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Guardian Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.guardian_name}
                onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Guardian Phone (SMS)</label>
              <input
                type="text"
                className="form-input"
                value={formData.guardian_contact}
                onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Update Learner
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Learners from Excel Modal (DepEd SF2 Format - e.g. add learner.xls sheet MARCH) */}
      <Modal 
        isOpen={isImportOpen} 
        onClose={() => { if (!importLoading) { setIsImportOpen(false); resetImportState(); } }} 
        title="Import Learners from Excel (.xls / .xlsx)"
        maxWidth="720px"
      >
        <div>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>
              <FileSpreadsheet size={18} />
              <span>DepEd Form SF2 Excel Parser</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Reads learner names (Column C) directly from the <strong>MARCH</strong> sheet or other monthly SF2 sheets (e.g. <code>add learner.xls</code>). It separates Male and Female sections automatically. Available data (Name &amp; Sex) will be saved and attendance QR codes will be generated instantly. LRN and guardian contacts can be completed later.
            </p>
          </div>

          {importError && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{importError}</span>
            </div>
          )}

          {/* File Picker Zone */}
          <div style={{
            border: '2px dashed ' + (importFile ? 'var(--primary)' : '#cbd5e1'),
            borderRadius: '12px',
            padding: '24px 16px',
            textAlign: 'center',
            background: importFile ? 'var(--primary-light)' : '#fdfdfd',
            cursor: 'pointer',
            position: 'relative',
            marginBottom: '16px',
            transition: 'all 0.2s ease'
          }}>
            <input 
              type="file" 
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={32} style={{ color: importFile ? 'var(--primary)' : 'var(--text-muted)' }} />
              <div>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.92rem' }}>
                  {importFile ? importFile.name : 'Click to select or drag & drop Excel file'}
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {importFile ? `${(importFile.size / 1024).toFixed(1)} KB • Click to choose a different file` : 'Supports .xls and .xlsx files (DepEd SF2 format)'}
                </div>
              </div>
            </div>
          </div>

          {/* Sheet Selector (if available) */}
          {importAvailableSheets.length > 0 && (
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Select Excel Sheet / Month</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Default: MARCH</span>
              </label>
              <select
                className="form-select"
                value={importSheetName}
                onChange={(e) => handleSheetChange(e.target.value)}
                disabled={importParsing || importLoading}
              >
                {importAvailableSheets.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    Sheet: {sheet} {sheet.trim().toUpperCase() === 'MARCH' ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Parsing Spinner */}
          {importParsing && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--primary)' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Analyzing Excel sheet and parsing learners...</div>
            </div>
          )}

          {/* Extracted Preview Table */}
          {importPreviewData && !importParsing && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f1f5f9',
                borderRadius: '8px',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Extracted Learners Preview ({importPreviewData.totalCount} Total)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-not-started">
                    {importPreviewData.maleCount} Male
                  </span>
                  <span className="badge badge-pending">
                    {importPreviewData.femaleCount} Female
                  </span>
                </div>
              </div>

              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <table style={{ margin: 0, fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Learner Name</th>
                      <th style={{ width: '80px' }}>Sex</th>
                      <th style={{ width: '100px' }}>Row in Sheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewData.learners.map((learner, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{learner.full_name}</td>
                        <td>
                          <span className={`badge ${learner.sex === 'M' ? 'badge-not-started' : 'badge-pending'}`}>
                            {learner.sex === 'M' ? 'Male' : 'Female'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          Row {learner.rowNumber || idx + 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Options */}
          {importPreviewData && !importParsing && (
            <div style={{
              background: '#f8fafc',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '18px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={importReplaceExisting}
                  onChange={(e) => setImportReplaceExisting(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>
                  <strong>Replace existing roster:</strong> Clear currently registered students in your teacher account before importing
                </span>
              </label>
              {importReplaceExisting && students.length > 0 && (
                <div style={{ color: '#b91c1c', fontSize: '0.75rem', marginTop: '4px', marginLeft: '22px' }}>
                  ⚠️ Warning: Your existing {students.length} students will be replaced.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setIsImportOpen(false); resetImportState(); }}
              disabled={importLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecuteImport}
              disabled={!importPreviewData || importPreviewData.totalCount === 0 || importLoading || importParsing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {importLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Importing Learners & Generating QRs...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>
                    Confirm &amp; Import {importPreviewData ? `(${importPreviewData.totalCount} Learners)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Student Face Biometric Scanner Modal */}
      <StudentFaceScannerModal
        isOpen={!!faceModalStudent}
        student={faceModalStudent}
        onClose={() => setFaceModalStudent(null)}
        onSuccess={() => {
          showAlert(`Face profile enrolled successfully for ${faceModalStudent?.full_name}!`);
          setFaceModalStudent(null);
          loadStudents();
        }}
      />

      {/* Student QR Code Badge View Modal */}
      <StudentQrModal
        isOpen={!!selectedQrStudent}
        student={selectedQrStudent}
        onClose={() => setSelectedQrStudent(null)}
      />
    </div>
  );
}
