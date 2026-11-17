# 동현항™: 출처·이용 안내

동현항은 1993년 Koei(光栄)의 「대항해시대 II」(PC-9801로 처음 발매)의 **큰 틀**에서 영감을 받은 비상업적 취미 작품이다. 「대항해시대 II」를 비롯한 원작 시리즈의 이름과 권리는 코에이 테크모 게임스(Koei Tecmo Games)에 있다. 동현항은 이들과 관계가 없고 승인도 받지 않았다.

## 원작에서 가져온 것

- 큰 틀만 참고했다: 16세기 바다에서 선장이 되어 함대를 이끌고 항구를 오가며 교역한다는 것.
- 원작 게임의 그림·음악·효과음·글·자료 수치·코드는 하나도 쓰지 않았다. 원작 파일과 그 일부는 이 저장소에 없고, 원작 파일에서 그림이나 자료를 꺼내 쓰지도 않았다.
- 항구의 시세와 시설, 배의 값·포·선체, 적 함대, 항해·교역·해전의 규칙과 수치는 모두 동현항이 정한 시험 값이다. 원작의 규칙·수치와 맞춰 보지 않았다.
- 항구 스무 곳은 1522년에 이미 교역하던 실제 항구이고, 자리는 실제 경위도다.

## 동현항이 새로 만든 것

- 공통 엔진(`src/engine/`: 루프 · 달력 · 사각·육각 격자와 길 찾기 · 타일 지도와 카메라 · 화면 나누기 · 장면 · 동현랭 어댑터). 동현삼(donghyun-lab16)과 같은 파일을 쓴다.
- 동현항의 자료 규격과 파서, 항해 · 교역 · 해전 규칙, 지도와 해전 장면(`src/hang/`), 동현랭 출전 규약과 예제, 문서, 시험.
- 자료 생성기(`tools/make_data.py`)와 그것이 만든 `src/hang/donghyun_hang_data.json`.
- 동현랭 실행기(`src/lang/donghyun.js`)는 [동현랭 저장소](https://github.com/Raspberry-Kim/donghyun-lang)의 v1.55를 고치지 않고 썼다. 편집기와 페이지 뼈대 · 시리즈 띠 · 입력 표식은 동현닥을 비롯한 동현 시리즈의 방식을 따랐다.

## 포동이

선장 포동이는 만든 사람의 강아지(말티즈)다. 포동이의 모습과 이름에 대한 권리는 MIT 코드 라이선스와 별개로 만든 사람에게 있다. 코드를 가져다 쓸 때 이 이름은 바꿔 쓰기를 권한다.

## 지도 자료

- Natural Earth, 1:110m Physical Vectors — Land (공공 영역): https://www.naturalearthdata.com/
  받은 파일(`tools/ne_110m_land.geojson`): https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
- 육지와 바다만 뽑아 경위도 1° 칸으로 옮겼다. 해안선은 오늘날 기준이고, 1° 칸에서 닫히는 좁은 해협 넷(지브롤터 · 도버 · 다르다넬스–보스포루스 · 말라카)은 손으로 텄다.

## 참고한 자료

- 大航海時代II — ウィキペディア: https://ja.wikipedia.org/wiki/大航海時代II
- 대항해시대 2 — 위키백과: https://ko.wikipedia.org/wiki/대항해시대_2
- Uncharted Waters — Wikipedia: https://en.wikipedia.org/wiki/Uncharted_Waters:_New_Horizons
- Koei Tecmo — Wikipedia: https://en.wikipedia.org/wiki/Koei_Tecmo

## v1.00 얼굴과 선박 연출

- 얼굴 초상은 머리색·헤어스타일의 넓은 모티브로 새로 생성하고 픽셀 크기로 정리한 이미지다. 원작 캡처나 공식 캐릭터 이미지를 포함하지 않는다. 화면에는 역할명만 표시한다.
- 이지스함은 [정조대왕함의 외형 설명](https://www.newsis.com/view/NISX20231121_0002528589)과 준비한 참고 그림을 바탕으로 32×22칸에 다시 그린 픽셀 선체다. 길이가 변하는 마스트 막대와 헬기 회전날개, 거북선 용머리의 불꽃은 비사실적 게임 연출이며 규칙 난수를 쓰지 않는다.
- 쇼펜하우어의 문장은 [Project Gutenberg의 Haldane·Kemp 영역본](https://www.gutenberg.org/files/38427/38427-h/38427-h.html) §1·§38·§57을 직접 옮겼다. 1522년을 배경으로 19세기 문장을 읽는 연출이다.

## v1.27 항구 협력자 얼굴

- 새 얼굴 36개는 기존 초상을 그림체 기준으로 삼아 새로 생성하고 96×128픽셀과 256색으로 정리한 이미지다. 특정 인물이나 원작 캐릭터를 본뜨지 않았고 원작 캡처나 공식 캐릭터 이미지를 포함하지 않는다.
- 지역 느낌은 피부색·머리 모양·장신구 한두 개로만 냈다. 역사 복식의 고증이 아니며 화면에는 역할명만 표시한다.

## 승리 팡파르

- 선율은 에드워드 엘가의 「위풍당당 행진곡」 1번(Op. 39 No. 1, 1901년 작곡·출판)의 트리오 첫 줄이다. 악보는 공공 영역이다([IMSLP의 작품 면](https://imslp.org/wiki/Pomp_and_Circumstance_March_No.1,_Op.39_No.1_(Elgar,_Edward))).
- 녹음이나 연주 음원을 쓰지 않았다. 음높이와 박자를 `src/sfx.js`에 적고 브라우저에서 합성한다. 조는 마지막 재현부의 D장조이고 빠르기와 악기 배치는 동현항이 정했다.
- 음을 대조한 악보: [G Major Music Theory의 쉬운 편곡](https://gmajormusictheory.org/Freebies/Level4/4Pomp/4Pomp.pdf), [IMSLP의 피아노 편곡](https://s9.imslp.org/files/imglnks/usimg/b/b7/IMSLP833625-PMLP898174-Elgar_Nacar_Pomp_and_Circumstance_1.pdf), [Hymnary의 선율 기록](https://hymnary.org/tune/land_of_hope_and_glory_elgar).

## 글꼴

검은고딕 Black Han Sans · Pretendard · 나눔고딕코딩 — SIL Open Font License 1.1 (`licenses/`).

## 라이선스

동현항 코드·문서: MIT (`LICENSE`). 동현랭 실행기: MIT (`licenses/DONGHYUN-MIT.txt`).
