from academics.models import ClassRoom, StudentProfile
from fees.models import StudentFeeAssignment, Payment

classes=['৪র্থ শ্রেণি','৫ম শ্রেণি','তৃতীয় শ্রেণি','প্রথম শ্রেণি','শিশু শ্রেণি','দ্বিতীয় শ্রেণি']
for cname in classes:
    try:
        cls=ClassRoom.objects.get(school_id=19,name=cname)
    except ClassRoom.DoesNotExist:
        print(cname,'missing class')
        continue
    students=StudentProfile.objects.filter(school_id=19,classroom=cls)
    print('\n'+cname, 'students', students.count())
    q=StudentFeeAssignment.objects.filter(student__in=students, is_waived=False).select_related('fee_structure','student','student__classroom')
    print('assignments', q.count())
    totals=0
    for a in q:
        fs=a.fee_structure
        staged=dict(
            student=a.student.user.username,
            fee=fs.classroom.name if fs.classroom else 'NA',
            freq=fs.frequency,
            amount=float(fs.amount),
            custom=float(a.custom_amount) if a.custom_amount else None,
            discount=float(a.discount_percentage),
            assigned_date=a.assigned_date,
            acad=fs.academic_year
        )
        paid=Payment.objects.filter(fee_assignment=a).aggregate(total=models.Sum('amount'))['total']
        paid=float(paid or 0)
        due=float(a.get_payable_amount())-paid
        print(' ',staged,'paid',paid,'due',due)
        totals += due
    print(' class due approx',totals)
