from rest_framework import serializers
from django.core.files.base import ContentFile
import base64
import re
from .models import School, Advertisement, BanbeisInfo, SchoolBilling

class SchoolBillingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolBilling
        fields = ['total_paid', 'updated_at']

class BanbeisInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = BanbeisInfo
        fields = '__all__'

class SchoolSerializer(serializers.ModelSerializer):
    logo_thumbnail_url = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    billing = SchoolBillingSerializer(read_only=True)

    class Meta:
        model = School
        fields = ['id', 'name', 'name_en', 'ein', 'email', 'phone_number', 'address', 'address_en', 'principal_name', 'principal_name_en', 'logo', 'logo_thumbnail', 'logo_thumbnail_url', 'principal_signature', 'school_seal', 'number_of_buildings', 'student_count', 'billing']
    
    def get_student_count(self, obj):
        try:
            if hasattr(obj, 'student_count_annotated'):
                return obj.student_count_annotated
            return obj.studentprofile_set.count()
        except Exception:
            return 0

    def get_logo_thumbnail_url(self, obj):
        try:
            if obj.logo_thumbnail:
                return obj.logo_thumbnail.url
            if obj.logo:
                return obj.logo.url
        except Exception:
            pass
        return None

    def to_internal_value(self, data):
        # Allow clearing image fields by sending an empty string
        ret = super().to_internal_value(data)
        for field in ['logo', 'principal_signature', 'school_seal']:
            if field in data and data[field] == '':
                ret[field] = None
        return ret

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        for field in ['logo', 'logo_thumbnail', 'principal_signature', 'school_seal']:
            try:
                img = getattr(instance, field, None)
                if img:
                    url = getattr(img, 'url', None) or str(img)
                    if request:
                        data[field] = request.build_absolute_uri(url)
                    else:
                        data[field] = url
            except Exception:
                pass
        return data


class AdvertisementSerializer(serializers.ModelSerializer):
    media_url = serializers.SerializerMethodField()

    class Meta:
        model = Advertisement
        fields = ['id', 'school', 'text', 'link', 'type', 'media', 'media_url', 'created_at']
        extra_kwargs = {
            'media': {'write_only': True, 'required': False}
        }

    def get_media_url(self, obj):
        try:
            if obj.media:
                return obj.media.url
        except Exception:
            pass
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        media_file = validated_data.get('media')
        # Support JSON body with media_data_url (data URL)
        if not media_file and request:
            try:
                media_data_url = request.data.get('media_data_url')
                if media_data_url and isinstance(media_data_url, str):
                    match = re.match(r'^data:(.+);base64,(.*)$', media_data_url)
                    if match:
                        mime = match.group(1)
                        b64 = match.group(2)
                        ext = (mime.split('/')[-1] or 'bin')
                        content = ContentFile(base64.b64decode(b64), name=f"ad_{validated_data.get('school').id}_{validated_data.get('type','image')}.{ext}")
                        validated_data['media'] = content
            except Exception:
                # If decoding fails, proceed without media to let validation raise
                pass
        return super().create(validated_data)
