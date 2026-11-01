"""Common shops and services in Germany, to find a payee's website (and so its logo) by name."""
import re

# (pattern on the lower-cased payee, website). First match wins, so specific ones go first.
MERCHANTS = [
    # Supermarkets and drugstores
    (r"\brewe\b", "rewe.de"), (r"\bedeka\b|\be center\b|\bmarktkauf\b", "edeka.de"), (r"\blidl\b", "lidl.de"),
    (r"\baldi ?nord\b", "aldi-nord.de"), (r"\baldi\b", "aldi-sued.de"), (r"\bnetto\b", "netto-online.de"),
    (r"\bpenny\b", "penny.de"), (r"\bkaufland\b", "kaufland.de"), (r"\bnorma\b", "norma-online.de"),
    (r"\bglobus\b", "globus.de"), (r"\btegut\b", "tegut.com"), (r"\balnatura\b", "alnatura.de"),
    (r"\bdenns\b", "denns-biosupermarkt.de"), (r"\bbio ?company\b", "biocompany.de"), (r"\bflink\b", "goflink.com"),
    (r"^dm\b|\bdm[- ]drogerie|\bdm-markt\b", "dm.de"), (r"\brossmann\b", "rossmann.de"), (r"\bm[uü]ller\b.*drogerie|^m[uü]ller$", "mueller.de"),
    (r"\bbudni\b", "budni.de"),
    # Shopping
    (r"\bamazon\b|\bamzn\b|\bamazon prime\b", "amazon.de"), (r"\bebay\b", "ebay.de"), (r"\bzalando\b", "zalando.de"),
    (r"\botto\b(?! ?bock)", "otto.de"), (r"\bikea\b", "ikea.com"), (r"\bmedia ?markt\b", "mediamarkt.de"),
    (r"\bsaturn\b", "saturn.de"), (r"\bh ?& ?m\b|\bh&m\b|^hm\b", "hm.com"), (r"\bprimark\b", "primark.com"),
    (r"\bdecathlon\b", "decathlon.de"), (r"\btk ?maxx\b", "tkmaxx.de"), (r"\baction\b", "action.com"),
    (r"\btedi\b", "tedi.com"), (r"\bobi\b", "obi.de"), (r"\bhornbach\b", "hornbach.de"), (r"\bbauhaus\b", "bauhaus.info"),
    (r"\btoom\b", "toom.de"), (r"\bdouglas\b", "douglas.de"), (r"\bthalia\b", "thalia.de"), (r"\bhugendubel\b", "hugendubel.de"),
    (r"\btchibo\b", "tchibo.de"), (r"\buniqlo\b", "uniqlo.com"), (r"\bzara\b", "zara.com"), (r"\bapple\b", "apple.com"),
    (r"\bgoogle\b", "google.com"), (r"\bshein\b", "shein.com"), (r"\btemu\b", "temu.com"), (r"\baliexpress\b", "aliexpress.com"),
    (r"\bgalaxus\b", "galaxus.de"), (r"\bcyberport\b", "cyberport.de"), (r"\bnotebooksbilliger\b", "notebooksbilliger.de"),
    (r"\bdeichmann\b", "deichmann.com"), (r"\bfressnapf\b", "fressnapf.de"),
    # Transport and travel
    (r"\bdeutsche bahn\b|\bdb vertrieb\b|\bdb fernverkehr\b|\bdb regio\b|^db\b|\bbahn\.de\b", "bahn.de"),
    (r"\bbvg\b", "bvg.de"), (r"\bmvg\b", "mvg.de"), (r"\bhvv\b", "hvv.de"), (r"\bvbb\b", "vbb.de"), (r"\brmv\b", "rmv.de"),
    (r"\bkvb\b", "kvb.koeln"), (r"\bflix ?(bus|train)?\b", "flixbus.de"), (r"\blufthansa\b", "lufthansa.com"),
    (r"\beurowings\b", "eurowings.com"), (r"\bryanair\b", "ryanair.com"), (r"\beasy ?jet\b", "easyjet.com"),
    (r"\bcondor\b", "condor.com"), (r"\buber\b(?! ?eats)", "uber.com"), (r"\bbolt\b", "bolt.eu"), (r"\bfree ?now\b", "free-now.com"),
    (r"\bshare ?now\b", "share-now.com"),
    (r"\bsixt\b", "sixt.de"), (r"\bairbnb\b", "airbnb.de"), (r"\bbooking\.com\b|\bbooking\b", "booking.com"),
    (r"\bexpedia\b", "expedia.de"),
    # Fuel
    (r"\baral\b", "aral.de"), (r"\bshell\b", "shell.de"), (r"\besso\b", "esso.de"), (r"^jet\b|\bjet tankstelle\b", "jet.de"),
    (r"\btotal ?energies\b|\btotal tankstelle\b", "totalenergies.de"), (r"\bagip\b", "eni.com"),
    # Food delivery and eating out
    (r"\blieferando\b", "lieferando.de"), (r"\bwolt\b", "wolt.com"), (r"\buber ?eats\b", "ubereats.com"),
    (r"\bmc ?donald'?s\b|\bmcdonalds\b", "mcdonalds.de"), (r"\bburger king\b", "burgerking.de"), (r"\bstarbucks\b", "starbucks.de"),
    (r"\bsubway\b", "subway.com"), (r"\bkfc\b", "kfc.de"), (r"\bvapiano\b", "vapiano.com"), (r"\bdunkin\b", "dunkin.de"),
    (r"\btoo ?good ?to ?go\b", "toogoodtogo.com"),
    # Subscriptions, phone and internet
    (r"\bnetflix\b", "netflix.com"), (r"\bspotify\b", "spotify.com"), (r"\bdisney\b", "disneyplus.com"),
    (r"\byoutube\b", "youtube.com"), (r"\bdazn\b", "dazn.com"), (r"\bsky\b", "sky.de"), (r"\baudible\b", "audible.de"),
    (r"\bchatgpt\b|\bopenai\b", "openai.com"), (r"\bmicrosoft\b|\bxbox\b", "microsoft.com"), (r"\bplaystation\b|\bsony\b", "playstation.com"),
    (r"\bsteam\b", "steampowered.com"), (r"\badobe\b", "adobe.com"), (r"\bdropbox\b", "dropbox.com"),
    (r"\btelekom\b", "telekom.de"), (r"\bvodafone\b", "vodafone.de"), (r"\bo2\b|\btelef[oó]nica\b", "o2online.de"),
    (r"\b1 ?& ?1\b|\b1und1\b", "1und1.de"), (r"\bcongstar\b", "congstar.de"), (r"\baldi talk\b", "alditalk.de"),
    (r"\bfraenk\b", "fraenk.de"), (r"\bgez\b|\brundfunkbeitrag\b|\bard zdf\b", "rundfunkbeitrag.de"),
    # Fitness, health and insurance
    (r"\burban ?sports\b", "urbansportsclub.com"), (r"\bmc ?fit\b", "mcfit.com"), (r"\bfitx\b", "fitx.de"),
    (r"\bclever fit\b", "clever-fit.com"), (r"\bjohn reed\b", "johnreed.fitness"),
    (r"\btechniker\b|^tk$", "tk.de"), (r"\baok\b", "aok.de"), (r"\bbarmer\b", "barmer.de"), (r"\bdak\b", "dak.de"),
    (r"\ballianz\b", "allianz.de"), (r"\bhuk\b", "huk.de"), (r"\bergo\b", "ergo.de"), (r"\bcheck24\b", "check24.de"),
    # Money
    (r"\bpaypal\b", "paypal.com"), (r"\bklarna\b", "klarna.com"), (r"\bwise\b", "wise.com"), (r"\brevolut\b", "revolut.com"),
    (r"\bn26\b", "n26.com"), (r"\btrade ?republic\b", "traderepublic.com"), (r"\bscalable\b", "scalable.capital"),
    (r"\bdkb\b", "dkb.de"), (r"\bcommerzbank\b", "commerzbank.de"), (r"\bdeutsche bank\b", "deutsche-bank.de"),
    (r"\bsparkasse\b", "sparkasse.de"), (r"\bing\b|\bing-diba\b", "ing.de"), (r"\bcomdirect\b", "comdirect.de"),
    (r"\bbarclays\b|\bbarclaycard\b", "barclays.de"), (r"\bamex\b|\bamerican express\b", "americanexpress.com"),
    (r"\bpostbank\b", "postbank.de"), (r"\bconsors(bank)?\b", "consorsbank.de"), (r"\bvolksbank\b|\braiffeisenbank\b", "vr.de"),
    (r"\bbunq\b", "bunq.com"), (r"\bhanseatic\b", "hanseaticbank.de"), (r"\badvanzia\b", "advanzia.com"), (r"\bc24\b", "c24.de"),
    (r"\btomorrow\b", "tomorrow.one"), (r"\bvivid\b", "vivid.money"), (r"\bsantander\b", "santander.de"),
    (r"\bhypovereinsbank\b|\bhvb\b", "hypovereinsbank.de"), (r"\btargobank\b", "targobank.de"), (r"\bnorisbank\b", "norisbank.de"),
    (r"\bmonzo\b", "monzo.com"), (r"\bcurve\b", "curve.com"), (r"\bmiles ?& ?more\b", "miles-and-more.com"),
    (r"\bpayback\b", "payback.de"),
    (r"\bvattenfall\b", "vattenfall.de"), (r"\beon\b|\be\.on\b", "eon.de"), (r"\bstadtwerke\b", "stadtwerke.de"),
    (r"\btibber\b", "tibber.com"), (r"\bostrom\b", "ostrom.de"), (r"\byello\b", "yello.de"), (r"\bpost\b|\bdhl\b", "dhl.de"),
    (r"\bhermes\b", "myhermes.de"),
]
_COMPILED = [(re.compile(p), d) for p, d in MERCHANTS]


def payee_key(payee: str) -> str:
    return re.sub(r"\s+", " ", (payee or "").strip().lower())


def guess_domain(payee: str):
    key = payee_key(payee)
    return next((d for p, d in _COMPILED if p.search(key)), None) if key else None
