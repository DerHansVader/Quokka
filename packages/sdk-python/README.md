# quokka-tracker

Python SDK for [Quokka](https://github.com/quokka-ml/quokka), a self-hosted experiment tracker.

```bash
pip install quokka-tracker
```

```python
import quokka

quokka.login("qk_...")  # or set QK_API_KEY
quokka.init(project="my-experiment")
quokka.log({"loss": 0.42, "accuracy": 0.91})
quokka.finish()
```

See the [project README](https://github.com/quokka-ml/quokka#readme) for the full guide.
