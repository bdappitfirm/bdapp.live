import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import { useSchool } from '../context/SchoolContext';
import { getClassOrder, compareClassOrder } from '../utils/classroomUtils';
import { getCleanDisplayName, sortStudentsByRoll } from '../utils/helpers';
import { getMediaUrl, resolveStudentPhoto } from '../utils/media';

// Helper to translate class name to Bangla
const translateClassToBangla = (className) => {
  const name = String(className || '').trim();
  const lower = name.toLowerCase();
  if (lower.includes('six') || lower.includes('ষষ্ঠ') || lower.includes('6')) return 'ষষ্ঠ';
  if (lower.includes('seven') || lower.includes('সপ্তম') || lower.includes('7')) return 'সপ্তম';
  if (lower.includes('eight') || lower.includes('অষ্টম') || lower.includes('8')) return 'অষ্টম';
  if (lower.includes('nine') || lower.includes('নবম') || lower.includes('9')) return 'নবম';
  if (lower.includes('ten') || lower.includes('দশম') || lower.includes('10')) return 'দশম';
  if (lower.includes('eleven') || lower.includes('একাদশ') || lower.includes('11')) return 'একাদশ';
  if (lower.includes('twelve') || lower.includes('দ্বাদশ') || lower.includes('12')) return 'দ্বাদশ';
  if (lower.includes('play') || lower.includes('প্লে')) return 'প্লে';
  if (lower.includes('nursery') || lower.includes('নার্সারি') || lower.includes('শিশু')) return 'শিশু';
  if (lower.includes('kg') || lower.includes('কেজি')) return 'কে.জি.';
  if (lower.includes('one') || lower.includes('১ম') || lower.includes('প্রথম') || lower.includes('1')) return '১ম';
  if (lower.includes('two') || lower.includes('২য়') || lower.includes('দ্বিতীয়') || lower.includes('2')) return '২য়';
  if (lower.includes('three') || lower.includes('৩য়') || lower.includes('তৃতীয়') || lower.includes('3')) return '৩য়';
  if (lower.includes('four') || lower.includes('৪র্থ') || lower.includes('চতুর্থ') || lower.includes('4')) return '৪র্থ';
  if (lower.includes('five') || lower.includes('৫ম') || lower.includes('পঞ্চম') || lower.includes('5')) return '৫ম';
  return name;
};

// Helper to check if class is Nine or Ten
const isNineOrTenClass = (className) => {
  const name = String(className || '').toLowerCase();
  return name.includes('নবম') || name.includes('দশম') || name.includes('nine') || name.includes('ten') || name.includes('9') || name.includes('10');
};

// Helper to translate gender
const translateGender = (gender) => {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'girl' || g === 'ছাত্রী' || g === 'f' || g === 'woman' || g === 'female_student') return 'ছাত্রী';
  if (g === 'male' || g === 'boy' || g === 'ছাত্র' || g === 'm' || g === 'man' || g === 'male_student') return 'ছাত্র';
  if (g === 'other') return 'অন্যান্য';
  return gender || '-';
};

// Helper to order sections correctly (A, B, C or ক, খ, গ)
const getSectionOrder = (sectionName) => {
  const name = String(sectionName || '').toLowerCase().trim();
  if (name.includes('ক') || name === 'a' || name === 'section a' || name === '1') return 1;
  if (name.includes('খ') || name === 'b' || name === 'section b' || name === '2') return 2;
  if (name.includes('গ') || name === 'c' || name === 'section c' || name === '3') return 3;
  if (name.includes('ঘ') || name === 'd' || name === 'section d' || name === '4') return 4;
  return 99;
};

export default function AllStudentsOverviewPage() {
  const { id } = useParams();
  const toast = useToast();
  const { school: schoolInfo } = useSchool();

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('all');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let allStudents = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 20) {
        const res = await scopedGet('/api/academics/students/', id, { page, page_size: 1000 });
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        if (list.length === 0) {
          hasMore = false;
        } else {
          allStudents = [...allStudents, ...list];
          if (!res.data?.next || list.length < 1000) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const subRes = await scopedGet('/api/academics/subjects/', id, { page_size: 500 }).catch(() => ({ data: [] }));
      const subjectList = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.results || []);

      setStudents(allStudents);
      setAllSubjects(subjectList);
    } catch (err) {
      console.error(err);
      toast.error('শিক্ষার্থীর তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  // Extract available classrooms from students
  const availableClassrooms = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      if (s.classroom?.id && s.classroom?.name) {
        map.set(String(s.classroom.id), s.classroom.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compareClassOrder(a.name, b.name));
  }, [students]);

  // Extract available sections based on selected classroom
  const availableSections = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      if (s.section?.id && s.section?.name) {
        if (selectedClassroom === 'all' || String(s.classroom?.id) === String(selectedClassroom)) {
          map.set(String(s.section.id), s.section.name);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [students, selectedClassroom]);

  const getFourthSubjectName = useCallback((s) => {
    if (!s.optional_subject) return '-';
    if (typeof s.optional_subject === 'object' && s.optional_subject !== null) {
      return s.optional_subject.name || '-';
    }
    const found = allSubjects.find(sub => String(sub.id) === String(s.optional_subject));
    return found ? found.name : '-';
  }, [allSubjects]);

  const filteredStudents = useMemo(() => {
    let result = students;

    if (selectedClassroom && selectedClassroom !== 'all') {
      result = result.filter(s => String(s.classroom?.id) === String(selectedClassroom));
    }

    if (selectedSectionFilter && selectedSectionFilter !== 'all') {
      result = result.filter(s => String(s.section?.id) === String(selectedSectionFilter));
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();

    return result.filter(s => {
      const name = (getCleanDisplayName(s.user?.first_name, s.user?.last_name) || s.name || '').toLowerCase();
      const roll = String(s.roll_number || '').toLowerCase();
      const className = String(s.classroom?.name || '').toLowerCase();
      const sectionName = String(s.section?.name || '').toLowerCase();
      const phone = String(s.user?.phone_number || s.phone_number || '').toLowerCase();
      const father = String(s.father_name || '').toLowerCase();
      const mother = String(s.mother_name || '').toLowerCase();
      const group = String(s.student_group || s.group || '').toLowerCase();
      const fourthSub = String(getFourthSubjectName(s)).toLowerCase();

      return (
        name.includes(q) ||
        roll.includes(q) ||
        className.includes(q) ||
        sectionName.includes(q) ||
        phone.includes(q) ||
        father.includes(q) ||
        mother.includes(q) ||
        group.includes(q) ||
        fourthSub.includes(q)
      );
    });
  }, [students, selectedClassroom, selectedSectionFilter, searchQuery, getFourthSubjectName]);

  const sectionGroups = useMemo(() => {
    const groupedMap = new Map();
    filteredStudents.forEach(s => {
      const clsNameRaw = s.classroom?.name || 'অনির্ধারিত শ্রেণি';
      const clsName = translateClassToBangla(clsNameRaw);

      const rawSec = s.section?.name || s.section_name || (typeof s.section === 'object' ? s.section?.name : s.section) || '';
      const secName = (rawSec && rawSec !== 'সকল শাখা' && rawSec !== '-' && rawSec !== 'সাধারণ' ? rawSec : '');

      const orderInfo = getClassOrder(clsNameRaw);
      const classOrder = orderInfo.baseRank;
      const sectionOrder = getSectionOrder(secName);
      const key = `${classOrder}___${orderInfo.is2027}___${clsName}___${sectionOrder}___${secName}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          classroomName: clsName,
          sectionName: secName,
          classOrder: classOrder,
          is2027: orderInfo.is2027,
          sectionOrder: sectionOrder,
          students: []
        });
      }
      groupedMap.get(key).students.push(s);
    });

    const groups = Array.from(groupedMap.values()).sort((a, b) => {
      if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
      if (a.is2027 !== b.is2027) return a.is2027 - b.is2027;
      if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
      return a.sectionName.localeCompare(b.sectionName);
    });

    groups.forEach(group => {
      group.students = sortStudentsByRoll(group.students);
    });

    return groups;
  }, [filteredStudents]);

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintSection = (groupKey) => {
    // Find matching classroom and section for this group and set them
    const group = sectionGroups.find(g => `${g.classroomName}_${g.sectionName}` === groupKey);
    if (group) {
      const clsObj = availableClassrooms.find(c => translateClassToBangla(c.name) === group.classroomName);
      if (clsObj) setSelectedClassroom(clsObj.id);
      if (group.sectionName) {
        const secObj = availableSections.find(sec => sec.name === group.sectionName);
        if (secObj) setSelectedSectionFilter(secObj.id);
      }
    }
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
        className="no-print"
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            একনজরে সকল শিক্ষার্থী
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ক্লাস ও সেকশন ফিল্টার এবং প্রিন্ট সুবিধাসহ সকল শিক্ষার্থীর তালিকা
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip label={`মোট: ${filteredStudents.length}`} color="primary" variant="outlined" />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            রিফ্রেশ
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            সব প্রিন্ট
          </Button>
        </Stack>
      </Stack>

      {/* Class and Section selectors above search bar */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }} className="no-print">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" fullWidth>
            <InputLabel>শ্রেণি নির্বাচন করুন</InputLabel>
            <Select
              value={selectedClassroom}
              label="শ্রেণি নির্বাচন করুন"
              onChange={(e) => {
                setSelectedClassroom(e.target.value);
                setSelectedSectionFilter('all'); // Reset section when class changes
              }}
            >
              <MenuItem value="all">সকল শ্রেণি</MenuItem>
              {availableClassrooms.map(c => (
                <MenuItem key={c.id} value={c.id}>{translateClassToBangla(c.name)} ({c.name})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>শাখা নির্বাচন করুন</InputLabel>
            <Select
              value={selectedSectionFilter}
              label="শাখা নির্বাচন করুন"
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
            >
              <MenuItem value="all">সকল শাখা</MenuItem>
              {availableSections.map(s => (
                <MenuItem key={s.id} value={s.id}>শাখা: {s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="medium"
            onClick={() => {
              setSelectedClassroom('all');
              setSelectedSectionFilter('all');
              setSearchQuery('');
            }}
            sx={{ minWidth: 100 }}
          >
            রিসেট
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ mb: 3 }} className="no-print">
        <TextField
          fullWidth
          placeholder="নাম, রোল, শ্রেণি, শাখা, গ্রুপ, ৪র্থ বিষয় বা পিতা/মাতার নাম দিয়ে খুঁজুন..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress />
        </Box>
      ) : sectionGroups.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</Typography>
        </Paper>
      ) : (
        sectionGroups.map((group, gIdx) => {
          const isNineTen = isNineOrTenClass(group.classroomName) || (group.students[0] && isNineOrTenClass(group.students[0].classroom?.name));
          const groupKey = `${group.classroomName}_${group.sectionName}`;

          // Rebalanced Column widths
          const colWidths = isNineTen ? {
            roll: '5%',
            name: '13%',
            group: '7%',
            fourth: '8%',
            gender: '7%',
            blood: '6%',
            phone: '10%',
            father: '19%',
            mother: '19%',
            photo: '6%'
          } : {
            roll: '6%',
            name: '17%',
            gender: '8%',
            blood: '7%',
            phone: '11%',
            father: '21%',
            mother: '24%',
            photo: '6%'
          };

          const hasSection = Boolean(group.sectionName && group.sectionName !== '' && group.sectionName !== 'সকল শাখা' && group.sectionName !== '-' && group.sectionName !== 'সাধারণ');

          return (
            <Paper
              key={gIdx}
              elevation={2}
              className="section-block"
              sx={{ mb: 4, p: { xs: 1, sm: 2 }, borderRadius: 2, overflow: 'hidden' }}
            >
              {/* Colorful Header for each section */}
              <Box
                sx={{
                  p: '0 16px',
                  mb: 2,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)',
                  color: 'white',
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 280px',
                  alignItems: 'center',
                  gap: 2,
                  minHeight: '70px'
                }}
              >
                {/* Left: Logo */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%', p: 0, m: 0 }}>
                  {schoolInfo?.logo && (
                    <Box
                      component="img"
                      src={getMediaUrl(schoolInfo.logo)}
                      alt="Logo"
                      sx={{
                        height: '65px',
                        width: '100px',
                        objectFit: 'fill',
                        bgcolor: 'transparent',
                        borderRadius: 0,
                        p: 0,
                        m: 0,
                        display: 'block'
                      }}
                    />
                  )}
                </Box>

                {/* Center: School Name & Student List */}
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2, textTransform: 'uppercase' }}>
                    {schoolInfo?.name || schoolInfo?.bn_name || 'HAZRAT SHAHJALAL HIGH SCHOOL'}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', opacity: 0.95 }}>
                    শিক্ষার্থী তালিকা
                  </Typography>
                </Box>

                {/* Right: Class & Section + Print Button */}
                <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5 }}>
                  <Chip
                    label={hasSection ? `শ্রেণি: ${group.classroomName} | শাখা: ${group.sectionName}` : `শ্রেণি: ${group.classroomName}`}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.90rem',
                      height: 'auto',
                      '& .MuiChip-label': {
                        whiteSpace: 'normal',
                        display: 'block',
                        padding: '6px 12px'
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={() => handlePrintSection(groupKey)}
                    className="no-print"
                    sx={{
                      bgcolor: 'white',
                      color: '#1a237e',
                      fontWeight: 'bold',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                  >
                    প্রিন্ট
                  </Button>
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f5f5f5', color: '#333', fontWeight: 'bold', whiteSpace: 'nowrap', borderBottom: '2px solid #ddd', overflow: 'hidden', textOverflow: 'ellipsis' } }}>
                      <TableCell align="center" sx={{ width: colWidths.roll }}>রোল</TableCell>
                      <TableCell align="center" sx={{ width: colWidths.name }}>নাম</TableCell>
                      {isNineTen && <TableCell sx={{ width: colWidths.group }}>গ্রুপ</TableCell>}
                      {isNineTen && <TableCell sx={{ width: colWidths.fourth }}>৪র্থ বিষয়</TableCell>}
                      <TableCell align="center" sx={{ width: colWidths.gender }}>লিঙ্গ</TableCell>
                      <TableCell align="center" sx={{ width: colWidths.blood }}>ব্লাড</TableCell>
                      <TableCell sx={{ width: colWidths.phone }}>মোবাইল নাম্বার</TableCell>
                      <TableCell sx={{ width: colWidths.father }}>পিতার নাম</TableCell>
                      <TableCell sx={{ width: colWidths.mother }}>মাতার নাম</TableCell>
                      <TableCell align="center" sx={{ width: colWidths.photo }}>ছবি</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.students.map((s, idx) => {
                      const name = getCleanDisplayName(s.user?.first_name, s.user?.last_name) || s.name || '-';
                      const roll = s.roll_number || '-';

                      const groupName = isNineTen
                        ? (s.student_group === 'science' ? 'বিজ্ঞান' : s.student_group === 'arts' ? 'মানবিক' : s.student_group === 'commerce' ? 'ব্যবসায়' : (s.student_group || s.group || '-'))
                        : '-';

                      const fourthSub = isNineTen ? getFourthSubjectName(s) : '-';

                      const rawGender = s.gender || s.user?.gender || s.profile?.gender || s.student_profile?.gender || '';
                      const gender = translateGender(rawGender);
                      const blood = s.blood_group || s.user?.blood_group || s.profile?.blood_group || s.student_profile?.blood_group || '-';
                      const father = s.father_name || '-';
                      const mother = s.mother_name || '-';
                      const phone = s.user?.phone_number || s.phone_number || '-';

                      const photoUrl = resolveStudentPhoto(s);

                      return (
                        <TableRow
                          key={s.id || idx}
                          sx={{
                            '&:nth-of-type(even)': { bgcolor: '#fafafa' },
                            '&:hover': { bgcolor: '#f1f1f1' },
                            height: '75px' // Row height for handwriting corrections
                          }}
                        >
                          <TableCell align="center" sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.roll }}>{roll}</TableCell>
                          <TableCell sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.name, textAlign: 'left' }}>{name}</TableCell>
                          {isNineTen && <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.group }}>{groupName}</TableCell>}
                          {isNineTen && <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.fourth }}>{fourthSub}</TableCell>}
                          <TableCell align="center" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.gender }}>{gender}</TableCell>
                          <TableCell align="center" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.blood }}>{blood}</TableCell>
                          <TableCell sx={{ wordBreak: 'break-all', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.phone }}>{phone}</TableCell>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.father }}>{father}</TableCell>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', pt: 1, pb: 2, width: colWidths.mother }}>{mother}</TableCell>
                          <TableCell align="center" sx={{ verticalAlign: 'top', p: 0, width: colWidths.photo, height: '75px' }}>
                            {photoUrl ? (
                              <Box
                                component="img"
                                src={photoUrl}
                                alt={name}
                                width="50"
                                height="75"
                                loading="eager"
                                decoding="sync"
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  minHeight: '75px',
                                  objectFit: 'fill',
                                  display: 'block',
                                  m: 0,
                                  p: 0
                                }}
                              />
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '9px', display: 'block', pt: 1.5 }}>
                                ছবি নেই
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          );
        })
      )}

      <style>{`
        @page {
          size: landscape;
          margin: 10mm;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
          }
          .section-block {
            box-shadow: none !important;
            margin-bottom: 20px !important;
            page-break-before: always;
            break-before: page;
          }
          .section-block:first-of-type {
            page-break-before: avoid;
            break-before: avoid;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          table {
            font-size: 9px !important;
            table-layout: fixed !important;
            width: 100% !important;
          }
          th, td {
            padding: 3px 2px !important;
            vertical-align: top !important;
            height: 75px !important;
            overflow: hidden !important;
            word-break: break-all !important;
          }
          td:last-child {
            padding: 0 !important;
          }
          img {
            max-height: 75px !important;
            object-fit: fill !important;
            display: block !important;
            width: 100% !important;
            height: 75px !important;
          }
        }
      `}</style>
    </Box>
  );
}
