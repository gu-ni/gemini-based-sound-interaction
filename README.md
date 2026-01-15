# KRAFTON Task 2 - Speech-to-Speech Preprocessing Pipeline

## Component Overview
- `src/pipeline.py`: Orchestrates diarization, role assignment, stereo construction, and transcription.
- `src/diarization.py`: Speaker diarization and assistant selection logic.
- `src/audio_utils.py`: WAV I/O helpers and segment-to-channel masking.
- `src/transcribe.py`: Word-level transcription for assistant speech.
- `data_stereo/`: Output directory holding `output.wav` and `output.json`.
- `data_stereo_inspect/`: Inspection outputs (all speakers, segment groups, timeline PNG).
- `wav_player/`: Optional WAV player for interactive inspection.

## Setup Instructions
1. Create a virtual environment (Python 3.10 is recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

## Usage Guidelines
Run the pipeline on the provided input audio:

```bash
python src/pipeline.py --input input.wav --output data_stereo
```

To control diarization speaker count (default: 3):

```bash
python src/pipeline.py --input input.wav --output data_stereo --num-speakers 3
```

To enable Whisper's verbose segment-level output during transcription:

```bash
python src/pipeline.py --input input.wav --output data_stereo --verbose
```

For environments without diarization or transcription models installed, you can run a mock pass to validate structure:

```bash
python src/pipeline.py --input input.wav --output data_stereo --mock
```

The output structure matches the required format:

```
data_stereo/
├── output.wav
└── output.json
```

Notes:
- `output.wav` is stereo with Left = Assistant and Right = User.
- `output.json` includes word-level Assistant alignments on the original global timeline.
- The `data_stereo_inspect/` and `wav_player/` artifacts are not required for submission; they are provided only to support smoother visualization and interactive inspection.
- `data_stereo_inspect/` is optional inspection output containing:
  - `output_all_speakers.json` (all speakers, labeled as `SPEAKER_MAIN`, `User_1`, `User_2`)
  - `output_segment_groups.json` (all speakers in grouped Whisper format)
  - `speaker_timeline.png` (speaker activity timeline)

## WAV Player (optional)
The WAV player was additionally created to provide intuitive understanding through visualization. To run the WAV player:

1. Start a local server from the project root:

```bash
python -m http.server 8000
```

2. Open the player in a browser:

```
http://localhost:8000/wav_player/
```

Screenshot:

![WAV Player Example](assets/img/wav_player_example.png)