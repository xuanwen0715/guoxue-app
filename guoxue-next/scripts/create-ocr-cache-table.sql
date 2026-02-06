-- OCR 结果缓存表
CREATE TABLE IF NOT EXISTS ocr_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash TEXT UNIQUE NOT NULL,
    ocr_text TEXT NOT NULL,
    ai_corrected TEXT,
    ai_suggestions JSONB DEFAULT '[]'::jsonb,
    method TEXT,
    scene TEXT,
    image_size INTEGER,
    char_count INTEGER,
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_hit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ocr_cache_hash ON ocr_cache(image_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_cache_created ON ocr_cache(created_at);

-- 清理过期缓存的函数（保留30天）
CREATE OR REPLACE FUNCTION cleanup_ocr_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM ocr_cache 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND hit_count < 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE ocr_cache IS 'OCR识别结果缓存表，用于节省API调用成本';
