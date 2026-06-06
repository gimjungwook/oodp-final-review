# 객체지향 설계패턴 — 기말고사 인터랙티브 복습

2026학년도 1학기 「객체지향 설계패턴(Object-Oriented Design Pattern)」 기말고사 대비 인터랙티브 복습 사이트.

빌드 도구 없이 순수 HTML/CSS/JavaScript로 작성했다. `index.html`을 브라우저로 열면 바로 동작하고, GitHub Pages에 그대로 배포된다.

## 구성

| 챕터 | 내용 |
|------|------|
| Ch.1 토대 | 패턴이란 무엇인가, GoF 3분류, 두 설계 원칙(인터페이스 의존, 합성 > 상속) |
| Ch.2 생성 패턴 | Singleton, Factory Method, Abstract Factory |
| Ch.3 구조 패턴 | Adapter, Decorator, Composite |
| Ch.4 행위 패턴 | Strategy, State, Command, Observer, Template Method, Iterator |
| Ch.5 시스템 / 객체 설계 | 서브시스템 분해, 아키텍처, 모델을 코드로 매핑하는 4가지 작업 |
| Ch.6 패턴 선택 / 비교 | 시나리오 기반 의사결정 흐름, 헷갈리는 6쌍 구분 |
| Problem Set | 백지 테스트 — 패턴 백지작성, 시나리오 풀이, UML 손그림, 비교 빈칸 |

각 패턴은 같은 순서로 풀린다: 의도 → 왜 필요한가(동기) → 구조(UML 클래스 다이어그램) → 참여자 → 결과(장단점) → 코드 → 시험 함정.

## 기술

- 정적 HTML / CSS / JavaScript (빌드 없음)
- UML 클래스 다이어그램: [Mermaid](https://mermaid.js.org/)
- 3D 히어로 시각화: [Three.js](https://threejs.org/)
- 폰트: Pretendard

## 로컬 실행

```bash
# 그냥 index.html을 브라우저로 열면 된다
open index.html
```

## 출처

- 한빛아카데미 「Java 객체지향 디자인 패턴」
- GoF, *Design Patterns: Elements of Reusable Object-Oriented Software*
- Bruegge & Dutoit, *Object-Oriented Software Engineering*
