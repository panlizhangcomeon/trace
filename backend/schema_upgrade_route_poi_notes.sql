-- MySQL / MariaDB：为已有数据库增加路线站点备注字段（与 Django 模型一致）
-- 若列已存在会报错，可忽略对应语句。

ALTER TABLE route_pois ADD COLUMN stop_note TEXT NULL COMMENT '当日路线站点备注，如时间';
ALTER TABLE route_pois ADD COLUMN segment_note TEXT NULL COMMENT '从上一站到本站的交通等备注';
