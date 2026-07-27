import React from 'react';
import {
  Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Stack, Card, CardHeader, CardContent
} from '@mui/material';

const toBn = (val) => {
  const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(val).replace(/\d/g, d => bn[d] ?? d);
};

const ResultSummaryTable = ({ summaryRows, loading }) => {
  const summaryFailBuckets = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <Card sx={{ mt: 4 }}>
      <CardHeader title="রেজাল্ট সামারি (পাস-ফেল)" />
      <CardContent>
        {loading && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <p>লোড হচ্ছে…</p>
          </Stack>
        )}
        {!loading && summaryRows.length === 0 && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <p>কোনো রেজাল্ট ডেটা পাওয়া যায়নি।</p>
          </Stack>
        )}
        {!loading && summaryRows.length > 0 && (
          <TableContainer component={Paper} sx={{ overflowX: 'auto', maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>ক্লাস</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>টোটাল</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>অনুপস্থিত</TableCell>
                  <TableCell align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>পাশ</TableCell>
                  {summaryFailBuckets.map((n) => (
                    <TableCell key={n} align="center" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>{toBn(n)} ফেল</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryRows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{row.class_name}</TableCell>
                    <TableCell align="center">{row.total}</TableCell>
                    <TableCell align="center">{row.absent}</TableCell>
                    <TableCell align="center" sx={{ color: 'success.main', fontWeight: 'bold' }}>{row.passed}</TableCell>
                    {summaryFailBuckets.map((n) => (
                      <TableCell key={n} align="center" sx={{ color: (row[`failed_${n}`] > 0 ? 'error.main' : 'inherit') }}>
                        {row[`failed_${n}`] || 0}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {summaryRows.length > 0 && (
                  <TableRow sx={{ bgcolor: 'action.selected' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>মোট</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{summaryRows.reduce((s, r) => s + r.total, 0)}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{summaryRows.reduce((s, r) => s + r.absent, 0)}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: 'success.dark' }}>{summaryRows.reduce((s, r) => s + r.passed, 0)}</TableCell>
                    {summaryFailBuckets.map((n) => (
                      <TableCell key={n} align="center" sx={{ fontWeight: 'bold' }}>
                        {summaryRows.reduce((s, r) => s + (r[`failed_${n}`] || 0), 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultSummaryTable;
