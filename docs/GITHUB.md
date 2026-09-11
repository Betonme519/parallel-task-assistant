# 多线程任务助手 · GitHub 项目信息

## About 简介

面向跨天、多阶段与并行工作的桌面任务时间线，串联任务进展与下一步，让等待中的事项保持可见。

## English description

A local-first desktop timeline for multi-stage, parallel work. Keep progress, next steps, and waiting tasks in view.

## Topics

`electron` `javascript` `windows` `productivity` `task-management` `timeline` `local-first` `workflow`

## 项目动机

多线程任务助手源于跨天任务推进和多线程工作中的上下文丢失问题。一件事通常需要经历准备、讨论、等待、修改和交付等多个阶段，按日期分散的记录容易割裂这些阶段之间的关系。在频繁切换任务时，等待回复或等待工具执行完成的事项又容易淡出注意力。

项目通过任务流程、历史节点与桌面侧边挂件，让一件事的进展连续可见，帮助使用者找到中断位置并继续推进。当前以手动记录为基础，截图识别提供可编辑的辅助建议。

## 技术说明

Electron 桌面集成与纯业务模型分层；本地保存队列串行处理写入，失败时保留内存状态；备份恢复与撤销支撑记录可靠性；AI 输出经过结构校验并由用户确认后保存。项目的重点是工作流表达、上下文恢复与本地数据管理。

尚未实现自动监听 Agent、协作消息或定时提醒，不应将这些能力作为现有功能介绍。
