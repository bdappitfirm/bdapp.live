import os
import json
try:
    from google import genai
except (ImportError, AttributeError):
    try:
        import google.genai as genai
    except ImportError:
        genai = None

from django.conf import settings
from .models import AIChatSession, AIChatMessage, AssistantKnowledge, AssistantMemory, School
from academics.models import StudentProfile, TeacherAssignment, ClassRoom
from django.db.models import Q
from datetime import datetime

class SoftwareAI:
    def __init__(self, school_id, user=None):
        self.school_id = school_id
        self.user = user
        self.api_key = os.environ.get('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', None)
        self.client = None
        if self.api_key and genai:
            self.client = genai.Client(api_key=self.api_key)

    def get_or_create_session(self, session_id=None):
        if session_id:
            try:
                return AIChatSession.objects.get(id=session_id, school_id=self.school_id)
            except AIChatSession.DoesNotExist:
                pass
        
        session = AIChatSession.objects.create(
            user=self.user,
            school_id=self.school_id,
            title="New Chat"
        )
        return session

    def get_context(self, session, user_query=None):
        # --- IMPROVEMENT 2: INCREASED CONVERSATION MEMORY (25 messages) ---
        messages = session.messages.order_by('-timestamp')[:25]
        messages = reversed(messages)
        context = "[Conversation History]:\n"
        for msg in messages:
            context += f"{msg.role.capitalize()}: {msg.content}\n"
        
        try:
            school = School.objects.get(id=self.school_id)
            context += f"\n[School Context]:\n- School Name: {school.name}\n- School ID: {self.school_id}\n"
            
            student_count = StudentProfile.objects.filter(school_id=self.school_id).count()
            teacher_count = TeacherAssignment.objects.filter(teacher__profile__school_id=self.school_id).values('teacher').distinct().count()
            class_count = ClassRoom.objects.filter(school_id=self.school_id).count()
            
            context += f"- Total Students: {student_count}\n"
            context += f"- Total Teachers: {teacher_count}\n"
            context += f"- Total Classes: {class_count}\n"
            
            context += f"- Current Date: {datetime.now().strftime('%Y-%m-%d')}\n"
            context += f"- Current Day: {datetime.now().strftime('%A')}\n"
            context += f"- Current Time: {datetime.now().strftime('%H:%M')}\n"
            
            context += "\n[Recent Students]:\n"
            students = StudentProfile.objects.filter(school_id=self.school_id).select_related('user', 'classroom', 'section')[:40]
            for sp in students:
                user = sp.user
                context += f"- {user.get_full_name() or user.username} | ID: {user.id} | Class: {sp.classroom.name if sp.classroom else 'N/A'} | Section: {sp.section.name if sp.section else 'N/A'} | Roll: {sp.roll_number or 'N/A'} | Blood Group: {sp.blood_group or 'N/A'} | Phone: {user.phone_number or 'N/A'}\n"
            
            try:
                from results.models import Result, Examination
                recent_exams = Examination.objects.filter(school_id=self.school_id).order_by('-date')[:8]
                if recent_exams.exists():
                    context += "\n[Recent Examinations]:\n"
                    for exam in recent_exams:
                        context += f"- Exam: {exam.name} | Date: {exam.date} | Type: {exam.exam_type}\n"
            except Exception as e:
                pass
                
            try:
                from attendance.models import AttendanceRecord
                today = datetime.now().date()
                today_attendance = AttendanceRecord.objects.filter(school_id=self.school_id, date=today)[:30]
                if today_attendance.exists():
                    context += f"\n[Today's Attendance ({today})]:\n"
                    present = today_attendance.filter(present=True).count()
                    absent = today_attendance.filter(present=False).count()
                    context += f"- Total: {present + absent} | Present: {present} | Absent: {absent}\n"
            except Exception as e:
                pass

            # --- IMPROVEMENT 1: ADD FEES DATA ---
            try:
                from fees.models import FeeSlip, Payment
                context += "\n[Recent Fee Data]:\n"
                recent_payments = Payment.objects.filter(school_id=self.school_id, payment_status='completed').order_by('-payment_date')[:15]
                if recent_payments.exists():
                    context += "- Recent Completed Payments:\n"
                    for payment in recent_payments:
                        student_name = payment.student.user.get_full_name() if payment.student and payment.student.user else "Unknown"
                        context += f"  - {student_name}: {payment.amount} Tk on {payment.payment_date}\n"
            except Exception as e:
                pass

            # --- IMPROVEMENT 1: ADD TEACHERS DATA ---
            try:
                from .models import Profile
                context += "\n[Teachers List]:\n"
                teachers = Profile.objects.filter(school_id=self.school_id, role='teacher').select_related('user')[:20]
                for teacher in teachers:
                    user = teacher.user
                    context += f"- {user.get_full_name() or user.username} | Designation: {teacher.designation or 'Teacher'} | Phone: {user.phone_number or 'N/A'}\n"
            except Exception as e:
                pass

        except Exception as e:
            print(f"Error getting school context: {e}")
        
        knowledge = AssistantKnowledge.objects.filter(school_id=self.school_id).order_by('-created_at')[:50]
        if knowledge.exists():
            context += "\n[Long-term Memory & Learned Facts]:\n"
            for k in knowledge:
                context += f"- {k.fact}\n"
            
        return context

    def ask(self, query, session_id=None, request=None):
        session = self.get_or_create_session(session_id)
        AIChatMessage.objects.create(session=session, role='user', content=query)
        
        context = self.get_context(session, query)
        
        rule_based_response = None
        if request:
            try:
                from .assistant_logic import AssistantLogic
                logic = AssistantLogic(request, school_id=self.school_id)
                
                # --- ALWAYS TRY RULE-BASED FIRST! ---
                # Because you said 99.99% answers are in the database!
                rule_based_response = logic.get_response(query, extra_params={'session_id': session.id})
                if rule_based_response and 'text' in rule_based_response:
                    text = rule_based_response['text']
                    # ALWAYS use rule-based response if available - we trust our database queries!
                    # Even if it says "দুঃখিত", that means it checked the DB and found nothing, which is better than AI hallucination
                    AIChatMessage.objects.create(session=session, role='assistant', content=text)
                    return {
                        'text': text,
                        'session_id': session.id,
                        'role': 'assistant'
                    }
            except Exception as e:
                print(f"Rule-based logic error: {e}")
        
        if self.client:
            try:
                # --- IMPROVEMENT 3: MORE POWERFUL PROMPT ---
                full_prompt = f"""
                You are a SUPER-INTELLIGENT, human-like AI Assistant for a school management software called "BDapp School Management".
                Language: MUST support both Bengali and English. Prefer Bengali if the user asks in Bengali.
                
                [YOUR PERSONALITY & BEHAVIOR - BE LIKE A FRIEND]:
                - You are warm, friendly, helpful, and very conversational.
                - You maintain the flow of conversation naturally like a human friend.
                - You ALWAYS remember the context from previous messages perfectly.
                - If the user's question is incomplete or ambiguous, you ASK CLARIFYING QUESTIONS instead of guessing.
                - After answering, you often offer to help with related topics naturally.
                - You have human-like behavior: use "হ্যাঁ", "না", "আচ্ছা", "ঠিক আছে", "ওহো!", "আসলে!", "দেখুন", etc., very naturally.
                - You use emojis occasionally to make the conversation friendlier (😊, ✅, 📚, 🏫, 📊, etc.) but don't overdo it.
                
                [YOUR CORE MISSION - BE LIKE A SUPER ASSISTANT]:
                1. School Data Questions: Answer ANY question about the school using the [School Context], [Recent Students], [Recent Examinations], [Teachers List], [Recent Fee Data], etc.
                2. General Knowledge: Answer general questions (history, science, coding, creative tasks, jokes, stories) using your own broad internal knowledge.
                3. Learning: Remember new facts, preferences, and habits the user shares - this is VERY IMPORTANT!
                4. Context Maintenance: ALWAYS maintain conversation history and context - this is your TOP PRIORITY!
                5. Analysis: You can analyze data from the context (e.g., "Which class has the most students?" or "Who has the highest attendance?").
                
                [IMPORTANT RULES FOR SCHOOL DATA]:
                1. ONLY use information from the [School Context], [Recent Students], [Recent Examinations], [Teachers List], [Recent Fee Data], [Conversation History], and [Long-term Memory].
                2. DO NOT HALLUCINATE school-specific facts. If you don't have data, say: "দুঃখিত, আমার ডাটাবেসে এই নির্দিষ্ট তথ্যটি পাওয়া যায়নি। 😔"
                3. For blood group questions: ALWAYS provide full details (Name, Class, Section, Roll, Phone) if available.
                4. For student questions: Look in [Recent Students] and [Conversation History] very carefully.
                5. For teacher questions: Look in [Teachers List] carefully.
                6. For fee questions: Look in [Recent Fee Data] carefully.
                7. For result questions: Look in [Recent Examinations] and analyze.
                
                [WHAT TO DO WITH INCOMPLETE QUESTIONS]:
                - If the user says "তার নাম", "কোন ক্লাসের", "ওর", etc., look at the previous messages to understand what "তার" or "ওর" refers to.
                - If you are unsure, ask a clarifying question like: "আপনি কার সম্পর্কে বলছেন? আমি সঠিকভাবে বুঝতে পারছি না! 😊"
                - Always refer back to the conversation history - this is CRITICAL!
                
                [Context & Data]:
                {context}
                
                [User Query]: 
                {query}
                
                [FINAL INSTRUCTIONS - REMEMBER THESE]:
                1. Respond in a natural, conversational way - NOT like a robot!
                2. Use Bengali if the user uses Bengali.
                3. If you learn ANY new facts, preferences, or habits from this interaction, NOTE THEM DOWN CLEARLY in your response if appropriate.
                4. Do NOT use any markdown or JSON in your final answer. Just plain, natural text with occasional emojis.
                5. Remember: You are a SUPER-INTELLIGENT assistant - you can do analysis, make connections, and be proactive!
                """
                
                response = self.client.models.generate_content(
                    model='gemini-2.0-flash',
                    contents=full_prompt
                )
                
                response_text = response.text.strip()
                
                AIChatMessage.objects.create(session=session, role='assistant', content=response_text)
                
                return {
                    'text': response_text,
                    'session_id': session.id,
                    'role': 'assistant'
                }
                    
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "quota" in error_msg.lower():
                    response_text = "দুঃখিত, আমি এই মুহূর্তে অনেক বেশি অনুরোধ পাচ্ছি (Gemini API Quota Exceeded)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। 😔"
                else:
                    response_text = f"দুঃখিত, আমি আপনার প্রশ্নের উত্তর দিতে পারছি না। সাময়িক সমস্যা হয়েছে: {str(e)[:100]} 😔"
        else:
            response_text = self._fallback_response(query, context)
        
        AIChatMessage.objects.create(session=session, role='assistant', content=response_text)
        return {
            'text': response_text,
            'session_id': session.id,
            'role': 'assistant'
        }

    def _fallback_response(self, query, context):
        q = query.lower()
        
        if any(word in q for word in ['কি কি শিখেছ', 'learned', 'knowledge', 'স্মৃতি']):
            knowledge = AssistantKnowledge.objects.filter(school_id=self.school_id).order_by('-created_at')[:10]
            if knowledge.exists():
                text = "আমি এখন পর্যন্ত যা যা শিখেছি:\n"
                for k in knowledge:
                    text += f"- {k.fact}\n"
                return text
            return "আমার স্মৃতিতে এখনো কোনো নতুন তথ্য নেই। আমাকে নতুন কিছু শেখান! 😊"

        if 'রক্ত' in q or 'blood' in q:
            return "রক্তের গ্রুপ সংক্রান্ত তথ্য ডাটাবেস থেকে চেক করা হচ্ছে... (Gemini API কী সেট করা থাকলে আমি আরও বিস্তারিত উত্তর দিতে পারতাম!) 😊"
            
        return "আমি আপনার প্রশ্নটি বুঝতে পেরেছি। তবে আমার পূর্ণ ক্ষমতার এআই ইঞ্জিন (Gemini) সক্রিয় করার জন্য একটি API কী প্রয়োজন। অনুগ্রহ করে .env ফাইলে GEMINI_API_KEY সেট করুন! 😊"

    def get_history(self, session_id):
        try:
            session = AIChatSession.objects.get(id=session_id, school_id=self.school_id)
            messages = session.messages.order_by('timestamp')
            return [{
                'role': m.role,
                'content': m.content,
                'timestamp': m.timestamp.isoformat()
            } for m in messages]
        except AIChatSession.DoesNotExist:
            return []
