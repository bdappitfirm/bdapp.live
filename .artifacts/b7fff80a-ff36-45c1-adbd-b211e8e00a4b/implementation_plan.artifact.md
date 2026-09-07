# Implementation Plan - School Onboarding Automation

This plan outlines the changes required to automate the creation of classes, sections, subjects, and sample students during school onboarding.

## User Review Required

> [!IMPORTANT]
> The "Board Standard" subjects will be hardcoded in the onboarding logic based on common curriculum patterns for Bangladesh schools.
>
> [!NOTE]
> Class 9-12 sections will be created as "বিজ্ঞান", "মানবিক", and "ব্যবসায় শিক্ষা" as requested.
> Class 6-8 sections will be created as "ক", "খ", and "গ".

## Proposed Changes

### Schools Component

#### [MODIFY] [models.py](file:///E:/BD School - Copy/schools/models.py)
- Add `class_range_start`, `class_range_end`, and `sample_student_count` to the `SchoolOnboarding` model.

#### [MODIFY] [admin.py](file:///E:/BD School - Copy/schools/admin.py)
- Update `SchoolOnboardingInline` to include the new fields.

#### [MODIFY] [onboarding.py](file:///E:/BD School - Copy/schools/onboarding.py)
- Implement `auto_generate_classes_and_subjects` function.
- Implement `create_sample_student_and_result` function.
- Update `onboard_school` to call these new functions when relevant fields are provided.

### Academics/Results Component (Logic within Onboarding)

- The logic for creating classes, sections, subjects, students, and results will be centralized in `onboarding.py` to keep the process atomic.

## Verification Plan

### Automated Tests
- Since this is a backend change in a Django admin context, I will verify by:
    1. Checking if the fields appear in the Admin UI (via `read_file` of updated files).
    2. Reviewing the logic in `onboarding.py` for correctness.
    3. (Optional) Run a script to simulate the onboarding process if a test environment is available.

### Manual Verification
- The user can test by adding a new school in the admin panel and providing the range (6-12) and sample student count (1).
- Verify that classes 6-12 are created with correct sections.
- Verify that subjects are created and linked.
- Verify that a student is created in Class 10 Science with a result card.
