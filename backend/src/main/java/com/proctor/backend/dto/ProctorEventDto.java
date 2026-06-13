package com.proctor.backend.dto;

import lombok.Data;

@Data
public class ProctorEventDto {
    private String examAttemptId;
    private String eventType;   // tab_switch, fullscreen_exit, copy_paste
    private String details;
}
