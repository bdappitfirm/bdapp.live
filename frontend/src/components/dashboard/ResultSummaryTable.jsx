import React from 'react';
import {
  Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Stack, Card, CardHeader, CardContent, Typography, Box
} from '@mui/material';

const toBn = (val) => {
  const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(val).replace(/\d/g, d => bn[d] ?? d);
};

const ResultSummaryTable = ({ summaryRows, loading }) => {
  const summaryFailBuckets = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <Card sx={{ mt: 4, overflow: 'hidden' }}>
      <CardHeader
        title="রেজাল্ট সামারি (পাস-ফেল)"
        subheader="বি.দ্র: অসম্পূর্ণ কলামগুলো ফেল তালিকারই একটি অংশ (তথ্যগত বিশ্লেষণের জন্য)"
      />
      <CardContent>
        {loading && <Stack alignItems="center" sx={{ py: 4 }}><p>লোড হচ্ছে…</p></Stack>}
        {!loading && summaryRows.length === 0 && <Stack alignItems="center" sx={{ py: 4 }}><p>কোনো রেজাল্ট ডেটা পাওয়া যায়নি।</p></Stack>}
        {!loading && summaryRows.length > 0 && (
          <TableContainer component={Paper} sx={{ overflowX: 'auto', maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', zIndex: 10 }}>ক্লাস</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>টোটাল</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>অনুপস্থিত</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 'bold' }}>পাশ</TableCell>
                  {summaryFailBuckets.map((n) => (
                    <TableCell key={n} align="center" sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 'bold' }}>{toBn(n)} ফেল</TableCell>
                  ))}
                  {/* ইনকমপ্লিট সেকশন শেষে */}
                  <TableCell align="center" sx={{ bgcolor: '#795548', color: 'white', fontWeight: 'bold', borderLeft: '3px solid #fff' }}>অসম্পূর্ণ (মোট)</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#8d6e63', color: 'white', fontSize: '10px' }}>১ বিষয়ে অ.</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#8d6e63', color: 'white', fontSize: '10px' }}>২ বিষয়ে অ.</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#8d6e63', color: 'white', fontSize: '10px' }}>৩ বিষয়ে অ.</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#8d6e63', color: 'white', fontSize: '10px' }}>৪ বিষয়ে অ.</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#8d6e63', color: 'white', fontSize: '10px' }}>৫+ বিষয়ে অ.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryRows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, bgcolor: '#f5f5f5' }}>{row.class_name}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.total}</TableCell>
                    <TableCell align="center" sx={{ color: row.absent > 0 ? 'error.main' : 'inherit' }}>{row.absent}</TableCell>
                    <TableCell align="center" sx={{ color: 'success.main', fontWeight: 'bold' }}>{row.passed}</TableCell>
                    {summaryFailBuckets.map((n) => (
                      <TableCell key={n} align="center" sx={{ color: (row[`failed_${n}`] > 0 ? 'error.main' : 'inherit') }}>
                        {row[`failed_${n}`] || 0}
                      </TableCell>
                    ))}
                    {/* ইনকমপ্লিট ডাটা */}
                    <TableCell align="center" sx={{ bgcolor: '#efebe9', fontWeight: 'bold', borderLeft: '2px solid #795548' }}>{row.incomplete || 0}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>{row.inc_1 || 0}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>{row.inc_2 || 0}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>{row.inc_3 || 0}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>{row.inc_4 || 0}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>{row.inc_5_plus || 0}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.selected', '& td': { fontWeight: 'bold', borderTop: '2px solid #ccc' } }}>
                  <TableCell>মোট</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.total) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.absent) || 0), 0)}</TableCell>
                  <TableCell align="center" sx={{ color: 'success.dark' }}>{summaryRows.reduce((s, r) => s + (parseInt(r.passed) || 0), 0)}</TableCell>
                  {summaryFailBuckets.map((n) => (
                    <TableCell key={n} align="center">
                      {summaryRows.reduce((s, r) => s + (parseInt(r[`failed_${n}`]) || 0), 0)}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ borderLeft: '2px solid #795548' }}>{summaryRows.reduce((s, r) => s + (parseInt(r.incomplete) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.inc_1) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.inc_2) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.inc_3) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.inc_4) || 0), 0)}</TableCell>
                  <TableCell align="center">{summaryRows.reduce((s, r) => s + (parseInt(r.inc_5_plus) || 0), 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultSummaryTable;
