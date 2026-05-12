# NPC AI — Comportamento e Árvore de Decisão

Documento de referência para o sistema de inteligência dos NPCs no Chomp 3D Web.  
Implementado em `NPCFsmSystem` + `HerbivoreThreatPolicy` / `CarnivoreThreatPolicy`.

---

## 1. Arquitetura

O comportamento de cada NPC é avaliado a cada tick pelo `NPCFsmSystem`.
A decisão segue o padrão **Strategy + Policy**:

```
NPCManager.update()
  └─ NPCFsmSystem.updateFSM(npc, strategy, allNPCs, ...)
        ├─ strategy.threatPolicy.evaluateThreat()
        ├─ canDefendAgainstThreat() / pack retaliation check
        ├─ strategy.foodTargetPolicy.findFood()
        └─ strategy.movementPolicy.pickWanderDestination()
```

---

## 2. Percepção: Duas Camadas

### Ameaças — Omnidirecional (360°)

`evaluateThreat()` usa **raio de distância puro**, sem campo de visão.  
O NPC "fareja" perigo em qualquer direção.

- Herbívoros: `threatRadius = 25u`
- Carnívoros: `threatRadius = 20u`

### Caça e Comida — Campo de Visão (FOV)

`findFood()` e a detecção de presas usam um cone de visão frontal com cheque de linha de visão:

| Dieta      | viewDistance | ângulo (aprox.) |
|------------|-------------|-----------------|
| Herbívoro  | ~60u        | ~240° (amplo)   |
| Carnívoro  | ~80u        | ~180° (focado)  |

Obstáculos (troncos, rochas) bloqueiam a linha de visão para caça e comida, mas **não** para detecção de ameaças.

---

## 3. Herbívoros — Árvore de Decisão Completa

```
TICK (Herbívoro)
│
├─[1] DETECÇÃO DE AMEAÇA (omnidirecional, allNPCs + playerPos real)
│      evaluateThreat retorna threatId se:
│        • Carnívoro NPC em raio 25u E nivel >= npc.level - 3
│        • Player carnívoro em raio 25u E playerLevel >= npc.level - 3
│
├─[2] TIMER DE REVIDE EM BANDO (retaliatePlayerPackTimer)
│      Ativado quando player ataca qualquer membro do bando.
│      Propagado a aliados mesma espécie dentro de 60u.
│      ┌─ timer > 0 E nível >= 10 (adulto)?
│      ├─ SIM → state = Hunting, alvo = player  ← prioridade sobre fuga
│      └─ NÃO → continua ↓
│
│      OBS: este bloco independe de threatId. Mesmo sem ameaça "natural"
│           detectada, agressão do player ativa revide do bando.
│
├─[3] DEFESA DE BANDO CONTRA AMEAÇA
│      Executado quando threatId != null (ameaça natural detectada)
│      ┌─ ameaça é o PLAYER?
│      │   ├─ nível >= 10 E aliado mesmo speciesId em 60u?
│      │   │   └─ SIM → state = Hunting, alvo = player
│      │   └─ NÃO (filhote OU sozinho) → FUGIR
│      └─ ameaça é NPC carnívoro?
│          ├─ nível >= 10 E aliado mesmo speciesId em 60u?
│          │   └─ SIM → state = Hunting, alvo = NPC carnívoro
│          └─ NÃO (filhote OU sozinho) → FUGIR
│
│      REGRA GERAL: filhotes (nível < 10) SEMPRE fogem, nunca defendem.
│      REGRA DE BANDO: adulto com ao menos 1 aliado mesma espécie em 60u
│                      SEMPRE defende, independente de diferença de força.
│
├─[4] LIMPEZA DE ESTADO ANTIGO
│      Se npc.defendingCarnivoreId está definido mas o carnívoro morreu
│      ou se distanciou > 50u → retorna ao Wandering.
│
├─[5] BUSCA DE COMIDA (FOV filtrado)
│      findFood(visibleNpcs, visibleEdibles)
│        • Plantas / frutas próximas    → Eating (recurso estático)
│      Herbívoros NÃO comem carcaças.
│      Herbívoros NUNCA atacam NPCs vivos nem o player como alvo de comida.
│
└─[6] WANDER
       Pick destino aleatório a cada wanderTimer expirado.
```

### Timers e Raios (Herbívoro)

| Parâmetro                | Valor | Descrição                                            |
|--------------------------|-------|------------------------------------------------------|
| `threatRadius`           | 25u   | Raio de detecção de ameaça (omnidirecional)          |
| `packDetectionRadius`    | 60u   | Raio para detectar aliados do bando                  |
| `herbivorePackDefenseDistance` | 60u | Raio máximo de perseguição em modo de revide   |
| `juvenileLevel`          | 10    | Abaixo disto: sempre foge, nunca defende             |
| `retaliatePlayerPackTimer` | 6s  | Duração do modo de revide em bando                   |

---

## 4. Carnívoros — Árvore de Decisão Completa

```
TICK (Carnívoro)
│
├─[1] DETECÇÃO DE AMEAÇA (omnidirecional, allNPCs + playerPos real)
│      evaluateThreat retorna threatId se:
│        • Carnívoro NPC em raio 20u E biteDamage(outro) > biteDamage(npc)
│        • Player (dietaCarnívoro) em raio 20u E biteDamage(player) > biteDamage(npc)
│      ┌─ threatId encontrado?
│      └─ SIM → state = Fleeing, fleeFromId = threatId  ← retorna
│
├─[2] REVIDE AO PLAYER (retaliatePlayerTimer)
│      Ativado quando player ataca este NPC.
│      ┌─ timer > 0 E player em raio 28u?
│      ├─ SIM → state = Hunting, alvo = player
│      └─ timer expirou OU player saiu de 28u → Wandering
│
├─[3] CAÇA E COMIDA (FOV filtrado)
│      findFood(visibleNpcs, visibleEdibles)
│        • NPC vivo em alcance (FOV)       → Hunting/Attacking
│        • Carcaça de qualquer espécie     → Eating
│      Carnívoros podem caçar herbívoros e carnívoros.
│
└─[4] WANDER
       Pick destino aleatório a cada wanderTimer expirado.
```

### Cálculo de Força (biteDamage)

```
biteDamage(strength, level) = (strength / 10) × (level^0.7 / 20^0.7)
```

| Espécie       | strength | biteDamage lvl 10 | biteDamage lvl 20 |
|---------------|----------|-------------------|-------------------|
| T-Rex         | 10       | 0.616             | 1.000             |
| Velociraptor  | 5        | 0.308             | 0.500             |
| Triceratops   | 9        | 0.554             | 0.900             |
| Stegosaurus   | 8        | 0.493             | 0.800             |
| Apatosaurus   | 10       | 0.616             | 1.000             |

**Exemplo:** Para player Velociraptor (str 5) superar T-Rex NPC nível 9 (biteDamage ≈ 0.616):
- Equação: `0.5 × (playerLvl^0.7 / 8.574) > 0.616`
- Necessário: player nível ≈ **27** como Velociraptor

### Timers (Carnívoro)

| Parâmetro               | Valor | Descrição                                        |
|-------------------------|-------|--------------------------------------------------|
| `threatRadius`          | 20u   | Raio de detecção de ameaça (omnidirecional)      |
| `biteForceDamageThreshold` | 1.0 | Foge somente se outro for MAIS FORTE (estrito) |
| `retaliatePlayerTimer`  | 6s   | Duração da perseguição ao player após ser atacado |
| carnivoreRetaliationDistance | 28u | Raio de perseguição em modo de revide        |

---

## 5. Interação de Sistemas

```
CombatSystem.playerAttackNPC()
  ├─ target.diet == 'Carnivore'
  │     → retaliatePlayerTimer = 6s
  │     → state = Hunting, alvo = player
  └─ target.diet == 'Herbivore'
        → retaliatePlayerPackTimer = 6s
        → state = Hunting, alvo = player
        → NPCFsmSystem vai propagar o timer a aliados no raio de 60u

NPCFsmSystem (por herbívoro no próximo tick):
  ├─ Vê aliado com retaliatePlayerPackTimer > 0 em raio 60u
  └─ Herda o timer → entra em modo de ataque (exceto filhotes)
```

---

## 6. Estamina e Exaustão

- Correr consome estamina; caminhar regenera
- NPC exausto: velocidade cai para `walkSpeed`, animação reflete cansaço
- A lógica é espelhada do player (mesmos limiares)
- Afeta herbívoros e carnívoros igualmente

---

## 7. Limitações Conhecidas e Decisões de Design

| Decisão | Justificativa |
|---------|---------------|
| Detecção de ameaça 360° | Simula instinto/olfato; não exige que o predador esteja no FOV |
| Defesa de bando ignora comparação de força | Comportamento de grupo é coletivo; um único Triceratops fraco entra em bando de outros Triceratops e todos defendem juntos |
| Revide de bando independe de threatId | Agressão direta do player aciona `retaliatePlayerPackTimer`, mesmo sem ameaça natural detectada |
| Player herbívoro não dispara fuga de herbívoros aliados | Herbívoros só veem player como ameaça se playerDiet == 'Carnivore' |
| Timer de revide NPC-NPC não implementado | O mecanismo de `evaluateThreat` omnidirecional cobre a maioria dos casos: carnívoros dentro de 25u de herbívoros em bando disparam defesa coletiva |
