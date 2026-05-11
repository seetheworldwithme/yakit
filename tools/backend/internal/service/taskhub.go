package service

import (
	"sync"

	"antifraud-workbench/backend/internal/model"
)

type TaskHub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan model.TaskEvent]struct{}
	lastEvent   map[string]model.TaskEvent
}

func NewTaskHub() *TaskHub {
	return &TaskHub{
		subscribers: map[string]map[chan model.TaskEvent]struct{}{},
		lastEvent:   map[string]model.TaskEvent{},
	}
}

func (h *TaskHub) Publish(evt model.TaskEvent) {
	h.mu.Lock()
	h.lastEvent[evt.TaskID] = evt
	subs := h.subscribers[evt.TaskID]
	for ch := range subs {
		select {
		case ch <- evt:
		default:
		}
	}
	h.mu.Unlock()
}

func (h *TaskHub) Subscribe(taskID string) (<-chan model.TaskEvent, func()) {
	ch := make(chan model.TaskEvent, 32)

	h.mu.Lock()
	if _, ok := h.subscribers[taskID]; !ok {
		h.subscribers[taskID] = map[chan model.TaskEvent]struct{}{}
	}
	h.subscribers[taskID][ch] = struct{}{}
	if evt, ok := h.lastEvent[taskID]; ok {
		ch <- evt
	}
	h.mu.Unlock()

	cancel := func() {
		h.mu.Lock()
		if set, ok := h.subscribers[taskID]; ok {
			delete(set, ch)
			if len(set) == 0 {
				delete(h.subscribers, taskID)
			}
		}
		close(ch)
		h.mu.Unlock()
	}
	return ch, cancel
}
