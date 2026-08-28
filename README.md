# Tempo & Relógio

Card personalizado para o Home Assistant que mostra:

- Relógio ao vivo (ao segundo) e data de hoje.
- Condição do tempo atual, temperatura, humidade e vento.
- Previsão com separadores **Diariamente** / **De hora em hora**, com ícone de dia e de noite por coluna.
- Fundo azul de dia e céu estrelado à noite, animações por condição (chuva, neve, nuvens, relâmpagos, sol).
- Índice UV e direção do vento.
- Faixa de aviso meteorológico opcional (ex: avisos do IPMA ou do MeteoAlarm).

## Instalação via HACS

1. HACS → menu ⋮ (três pontos) → **Repositórios personalizados**.
2. Adiciona o URL deste repositório, categoria **Dashboard**.
3. Procura por "Tempo & Relógio" em HACS → Frontend e instala.
4. Recarrega a página do navegador.

## Configuração do card

```yaml
type: custom:tempo-relogio-card
entity: weather.home          # a tua entidade de meteorologia
name: Casa                    # opcional, default = nome da entidade
time_format: 24                # 24 ou 12, default 24
show_seconds: true             # default true (relógio ao vivo, ao segundo)
forecast_days: 5               # default 5, 0 esconde a previsão diária
forecast_hours: 12             # default 12, quantas horas mostrar no separador horário
alert_entity: sensor.ipma_avisos   # opcional — entidade de avisos meteorológicos
                                    # (ex: sensor de avisos do IPMA, ou um
                                    # binary_sensor do MeteoAlarm)
```
