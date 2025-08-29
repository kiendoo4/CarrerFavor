import requests
from .config import settings


def extract_text_via_tika(raw_bytes: bytes, content_type: str | None, filename: str | None = None) -> str:
    headers = {
        'Accept': 'text/plain; charset=utf-8'
    }
    if content_type:
        headers['Content-Type'] = content_type
    else:
        headers['Content-Type'] = 'application/octet-stream'

    resp = requests.put(settings.tika_url, data=raw_bytes, headers=headers, timeout=60)
    resp.raise_for_status()
    
    # Try to decode with UTF-8 first, fallback to other encodings if needed
    try:
        text = resp.content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text = resp.content.decode('latin-1')
        except UnicodeDecodeError:
            text = resp.content.decode('cp1252', errors='ignore')
    
    text = text or ""
    
    # Clean text: remove NUL characters and other problematic characters
    text = text.replace('\x00', '')  # Remove NUL characters
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')  # Keep only printable chars
    
    # Normalize Vietnamese characters
    text = text.replace('à', 'à').replace('á', 'á').replace('ả', 'ả').replace('ã', 'ã').replace('ạ', 'ạ')
    text = text.replace('ă', 'ă').replace('ằ', 'ằ').replace('ắ', 'ắ').replace('ẳ', 'ẳ').replace('ẵ', 'ẵ').replace('ặ', 'ặ')
    text = text.replace('â', 'â').replace('ầ', 'ầ').replace('ấ', 'ấ').replace('ẩ', 'ẩ').replace('ẫ', 'ẫ').replace('ậ', 'ậ')
    text = text.replace('è', 'è').replace('é', 'é').replace('ẻ', 'ẻ').replace('ẽ', 'ẽ').replace('ẹ', 'ẹ')
    text = text.replace('ê', 'ê').replace('ề', 'ề').replace('ế', 'ế').replace('ể', 'ể').replace('ễ', 'ễ').replace('ệ', 'ệ')
    text = text.replace('ì', 'ì').replace('í', 'í').replace('ỉ', 'ỉ').replace('ĩ', 'ĩ').replace('ị', 'ị')
    text = text.replace('ò', 'ò').replace('ó', 'ó').replace('ỏ', 'ỏ').replace('õ', 'õ').replace('ọ', 'ọ')
    text = text.replace('ô', 'ô').replace('ồ', 'ồ').replace('ố', 'ố').replace('ổ', 'ổ').replace('ỗ', 'ỗ').replace('ộ', 'ộ')
    text = text.replace('ơ', 'ơ').replace('ờ', 'ờ').replace('ớ', 'ớ').replace('ở', 'ở').replace('ỡ', 'ỡ').replace('ợ', 'ợ')
    text = text.replace('ù', 'ù').replace('ú', 'ú').replace('ủ', 'ủ').replace('ũ', 'ũ').replace('ụ', 'ụ')
    text = text.replace('ư', 'ư').replace('ừ', 'ừ').replace('ứ', 'ứ').replace('ử', 'ử').replace('ữ', 'ữ').replace('ự', 'ự')
    text = text.replace('ỳ', 'ỳ').replace('ý', 'ý').replace('ỷ', 'ỷ').replace('ỹ', 'ỹ').replace('ỵ', 'ỵ')
    text = text.replace('đ', 'đ')
    
    # Uppercase Vietnamese characters
    text = text.replace('À', 'À').replace('Á', 'Á').replace('Ả', 'Ả').replace('Ã', 'Ã').replace('Ạ', 'Ạ')
    text = text.replace('Ă', 'Ă').replace('Ằ', 'Ằ').replace('Ắ', 'Ắ').replace('Ẳ', 'Ẳ').replace('Ẵ', 'Ẵ').replace('Ặ', 'Ặ')
    text = text.replace('Â', 'Â').replace('Ầ', 'Ầ').replace('Ấ', 'Ấ').replace('Ẩ', 'Ẩ').replace('Ẫ', 'Ẫ').replace('Ậ', 'Ậ')
    text = text.replace('È', 'È').replace('É', 'É').replace('Ẻ', 'Ẻ').replace('Ẽ', 'Ẽ').replace('Ẹ', 'Ẹ')
    text = text.replace('Ê', 'Ê').replace('Ề', 'Ề').replace('Ế', 'Ế').replace('Ể', 'Ể').replace('Ễ', 'Ễ').replace('Ệ', 'Ệ')
    text = text.replace('Ì', 'Ì').replace('Í', 'Í').replace('Ỉ', 'Ỉ').replace('Ĩ', 'Ĩ').replace('Ị', 'Ị')
    text = text.replace('Ò', 'Ò').replace('Ó', 'Ó').replace('Ỏ', 'Ỏ').replace('Õ', 'Õ').replace('Ọ', 'Ọ')
    text = text.replace('Ô', 'Ô').replace('Ồ', 'Ồ').replace('Ố', 'Ố').replace('Ổ', 'Ổ').replace('Ỗ', 'Ỗ').replace('Ộ', 'Ộ')
    text = text.replace('Ơ', 'Ơ').replace('Ờ', 'Ờ').replace('Ớ', 'Ớ').replace('Ở', 'Ở').replace('Ỡ', 'Ỡ').replace('Ợ', 'Ợ')
    text = text.replace('Ù', 'Ù').replace('Ú', 'Ú').replace('Ủ', 'Ủ').replace('Ũ', 'Ũ').replace('Ụ', 'Ụ')
    text = text.replace('Ư', 'Ư').replace('Ừ', 'Ừ').replace('Ứ', 'Ứ').replace('Ử', 'Ử').replace('Ữ', 'Ữ').replace('Ự', 'Ự')
    text = text.replace('Ỳ', 'Ỳ').replace('Ý', 'Ý').replace('Ỷ', 'Ỷ').replace('Ỹ', 'Ỹ').replace('Ỵ', 'Ỵ')
    text = text.replace('Đ', 'Đ')
    
    return text

