# School Onboarding Automation Fix

The goal is to fix the automatic creation of classes, sections, and subjects when a school is onboarded. The system should automatically create classes within a specified range, ensure each class has 3 sections (according to board rules), and assign the correct subjects to each section.

## User Review Required

> [!IMPORTANT]
> The current logic for Madrasah schools only creates 1 or 2 sections. I will update it to create 3 sections as requested. For Madrasah classes 9-10 and 11-12, I will add the 'Muzabbid' (মুজাব্বিদ) group to reach 3 sections.
>
> The automation currently skips if "Is processed" is already checked. I will adjust this so that it can run if the user manually triggers it or if it hasn't been successfully completed before.

## Proposed Changes

### Schools Component

#### [MODIFY] [onboarding.py](file:///E:/BD School - Copy/schools/onboarding.py)
- Update `auto_generate_classes_and_subjects` to:
    - Ensure 3 sections for Madrasah classes (currently only 1 or 2).
    - Use Bengali section names ('ক', 'খ', 'গ') for all general classes to match board standards.
    - Add 'মুজাব্বিদ' (Muzabbid) group to Madrasah class 9-12 to complete 3 sections.
- Modify `onboard_school` to handle the `is_processed` flag correctly when called from the Admin panel.
- Ensure all subjects are correctly linked to both ClassRoom and Section.

#### [MODIFY] [admin.py](file:///E:/BD School - Copy/schools/admin.py)
- Improve the feedback message in `SchoolAdmin.save_related` to better inform the user when automation runs or skips.

## Verification Plan

### Automated Tests
- I will use the existing `scratch/debug_onboarding_final.py` (or a modified version) to verify that creating a new school with a class range (e.g., 6-12) correctly generates:
    - 7 ClassRooms.
    - 3 Sections for each ClassRoom.
    - Correct number of Subjects linked to each Section.

### Manual Verification
- The user can verify by adding a new school in the Django Admin, filling the "Onboarding" section with a class range, and checking if the "Classes", "Sections", and "Subjects" are populated automatically in the respective admin sections.
