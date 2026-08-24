#ifndef _FCEU_CHEAT_H
#define _FCEU_CHEAT_H

#include <stddef.h>

extern uint8_t *MMapPtrs[64];

void FCEU_CheatResetRAM(void);
void FCEU_CheatAddRAM(int s, uint32_t A, uint8_t *p);

/* Lightweight, side-effect-free access to the mapped CPU address space.
 * These helpers are intended for instrumented frontends. They only expose
 * addresses backed by normal memory and deliberately avoid invoking device
 * read/write handlers. */
int FCEU_CheatPeek(uint16_t address, uint8_t *value);
int FCEU_CheatPoke(uint16_t address, uint8_t value);
size_t FCEU_CheatSnapshot(uint8_t *values, uint8_t *valid, size_t capacity);

void FCEU_LoadGameCheats(void);
void FCEU_FlushGameCheats(void);
void FCEU_ApplyPeriodicCheats(void);
void FCEU_PowerCheats(void);

void FCEU_ResetCheats(void);

#endif
